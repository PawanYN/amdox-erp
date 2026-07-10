# Notification Engine — Concepts Learned

This doc explains the general backend concepts behind the Day 19 notification
engine work (preferences, email dispatch, SSE push, BullMQ retry/dead-letter
queue), written so they can be applied to any project, not just Amdox. Each
section pairs the concept with the concrete code from this project so you can
see the idea and the implementation side by side.

---

## 1. Event-driven architecture (pub/sub)

**The problem it solves:** if `EmployeeService.create()` had to directly call
`NotificationService.notify()`, `AuditService.log()`, `WebhookService.fire()`,
etc., every time you added a new side effect you'd have to edit
`EmployeeService` again — and `EmployeeService` would need to know about
modules that have nothing to do with employees.

**The pattern:** the thing that happens (employee created) is announced as an
**event**, and anyone interested can listen for it independently:

```ts
// employee.service.ts — doesn't know or care who's listening
this.eventEmitter.emit('employee.created', { tenantId, employeeId, userId: actingUserId });
```

```ts
// notification-event.listener.ts — a completely separate file
@OnEvent('employee.created')
async onEmployeeCreated(payload: { tenantId: string; employeeId: string; userId?: string }) {
  await this.notifications.notify({ eventType: 'employee.created', ... });
}
```

**Why it matters:** this is why the entire notification/email/SSE/queue system
in this session could be built and changed without touching a single line of
HR code. The producer and consumer are decoupled — you can add, remove, or
change listeners freely.

**When to reach for this:** any time one action should trigger multiple
unrelated side effects. If you find yourself calling five unrelated services
in a row inside one method, that's usually a sign to emit an event instead.

---

## 2. The "opt-out with a default" pattern

`NotificationPreference` only stores rows for settings a user has explicitly
changed — not one row per user per event type per channel (which would be a
huge, mostly-empty table).

```ts
private async isChannelEnabled(userId, eventType, channel): Promise<boolean> {
  if (!userId) return true;
  const pref = await this.prisma.notificationPreference.findFirst({ where: { userId, eventType, channel } });
  return pref?.isEnabled ?? true;   // no row = enabled by default
}
```

**Why this shape:** if a table stored every combination explicitly, adding a
new event type would mean inserting a row for every existing user just to
mark it "enabled" — a migration nightmare. Instead, "no row" _is_ the default,
and you only ever write a row when someone deviates from it. This is the same
shape as feature flags, cookie-consent settings, and most "preferences" tables
you'll encounter.

---

## 3. Why background job queues exist

**Before:** `notify()` called the webhook/email dispatch inline, in the same
request that created the employee:

```ts
// OLD — the user's own HTTP request waits on a network call to someone else's server
const ok = await this.webhookChannel.dispatch(webhookUrl, secret, payload);
```

If that external server took 8 seconds to respond (or hung), the person
creating an employee sat there waiting for something that has nothing to do
with creating an employee.

**After:** the request just enqueues a job and returns immediately; a
separate **worker process** picks the job up and does the slow, unreliable
part on its own time:

```ts
// notification.service.ts — returns fast, doesn't wait on the network
await this.dispatchQueue.add('webhook-dispatch', jobData, { attempts: 5, backoff: {...} });
```

```ts
// notification-dispatch.processor.ts — runs separately, can take as long as it needs
@Processor('notification-dispatch')
export class NotificationDispatchProcessor extends WorkerHost {
  async process(job) {
    /* the actual slow/unreliable work happens here */
  }
}
```

**The general rule:** anything that (a) doesn't need to finish before you can
respond to the user, and (b) talks to something outside your own database
(another API, an email provider, a payment gateway) is a candidate for a
queue instead of an inline `await`.

---

## 4. Retries with exponential backoff

A failed network call is very often **transient** — the other server had a
one-second hiccup, a DNS blip, a momentary overload. Retrying instantly just
slams into the same problem again. Waiting a bit longer between each retry
gives the problem time to go away on its own:

```ts
{ attempts: 5, backoff: { type: 'exponential', delay: 2000 } }
// retry 1: wait 2s, retry 2: wait 4s, retry 3: wait 8s, retry 4: wait 16s
```

Verified live in this session: a webhook pointed at an unreachable address
went `PENDING → RETRYING (attempt 2) → FAILED (attempt 3)` — each retry
automatically scheduled by BullMQ, no code needed beyond the config above.

**When not to retry:** don't retry something that will _never_ succeed no
matter how many times you try (e.g., "this tenant simply has no webhook URL
configured"). That's not a transient failure — it's a permanent "not
applicable" case, and it should be treated differently (see the
`'not-applicable'` branch in `notification-dispatch.processor.ts`, which marks
the delivery FAILED once with no retries wasted on it).

---

## 5. Dead-letter queues

When a job exhausts all its retries, what happens to it? Two choices:

- **Silently discard it** — the job vanishes, nobody ever finds out it failed,
  and there's no record for debugging. This is data loss with no trace.
- **Keep it somewhere inspectable** — a "dead-letter queue" — so a human can
  later look at what failed and why, and decide whether to retry manually or
  investigate the root cause.

```ts
await this.dispatchQueue.add(name, jobData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnFail: false, // <-- this is the whole dead-letter decision
});
```

Bull Board (mounted at `/admin/queues`) is just a UI on top of that "kept"
data — it shows exactly which jobs failed, how many times, and the error
message from the last attempt.

**General rule:** for anything asynchronous and retryable, always ask
"where does it go if it never succeeds?" before shipping it. If the answer
is "nowhere, it just disappears," that's usually a bug waiting to hide a real
production problem.

---

## 6. Real-time push: SSE vs. polling vs. WebSockets

Three ways a server can get new data to a browser:

| Approach   | How it works                                                         | Trade-off                                                           |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Polling    | Client asks "anything new?" every N seconds                          | Simple, but wastes requests and has up to N seconds of lag          |
| SSE        | Server keeps one HTTP connection open, pushes data whenever it wants | One-directional (server→client only), simple, works over plain HTTP |
| WebSockets | Full two-way, always-open connection                                 | Most powerful, but more infrastructure to set up and maintain       |

This project already had SSE for BI metrics (`bi.controller.ts`), just on a
fixed interval (`interval(5000)` — still technically polling, just done on
the server side). The notification stream is _actually_ push-driven — an
RxJS `Subject` fires only when a real event happens:

```ts
private readonly stream$ = new Subject<NotificationStreamEvent>();
// ...inside notify(), right after creating the notification:
this.stream$.next({ tenantId, userId, notification });
```

```ts
@Sse('stream')
stream(@Req() req): Observable<MessageEvent> {
  return this.notificationService.getStream().pipe(
    filter(evt => evt.tenantId === tenantId && (!evt.userId || evt.userId === userId)),
    map(evt => ({ data: evt.notification }) as MessageEvent),
  );
}
```

**When to reach for SSE specifically:** you need real-time updates, but only
in one direction (server tells client "something happened") — notifications,
live dashboards, progress bars. Save WebSockets for when the client also
needs to send frequent messages back (chat, collaborative editing).

---

## 7. Admin/debug tooling needs its own authentication

Bull Board shows job payloads — which, in this app, include tenant IDs, user
IDs, and notification content. Mounting it with no protection would mean
anyone who finds the URL can read that data. It's a different concern from
normal user login (Keycloak JWT), so it got its own simple gate:

```ts
expressApp.use('/admin/queues', (req, res, next) => {
  const provided = /* decode Basic Auth header */;
  if (provided !== `${process.env.BULL_BOARD_USER}:${process.env.BULL_BOARD_PASSWORD}`) {
    res.status(401).send('Authentication required');
    return;
  }
  next();
});
```

**General rule:** any internal dashboard, debug endpoint, or admin tool you
bolt onto an app needs _some_ barrier in front of it — even a "hidden" URL is
not a real barrier, since URLs leak (browser history, logs, screen shares).

---

## 8. The most important lesson: verify against the real running system

Twice in this session, code that looked completely correct on read turned out
wrong (or looked wrong when it was actually fine) only once it was actually
run:

- **A real bug that reading the code wouldn't obviously reveal:**
  `po.created`/`project.created`/`employee.created` listeners were silently
  dropping `payload.userId` before calling `notify()` — the TypeScript types
  even said `userId?: string` was expected, but the object literal simply
  never included it. Typechecking is happy either way; only _running_ the
  flow and checking what landed in the database revealed it.

- **A false alarm that looked like a real bug:** Bull Board's job-listing API
  threw a `WRONGTYPE` Redis error that looked exactly like a version
  incompatibility. Tracing the actual Redis commands with `MONITOR` showed
  the real cause: a wrong URL shape in my own test request
  (`/api/queues/:name/:jobId` treats the second segment as a job ID, not a
  status filter) — not a library bug at all.

**Neither of these would have been caught by "the code compiles" or "it looks
right on read."** Both were only found by triggering the real flow, inspecting
the real output (a database row, a Redis command trace), and being willing to
say "wait, that's not what I expected" instead of assuming the first
plausible explanation. This is the single most transferable habit from this
whole session: when something matters, prove it against the real system, not
just against your mental model of it.
