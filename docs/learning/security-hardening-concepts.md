# Security Hardening — Concepts Learned

This doc explains the general security concepts behind the PLAT-04 hardening
work (`docs/security-hardening-audit.md`), written so they apply to any
backend project, not just Amdox. Each section pairs the concept with the
concrete code from this project so you can see the idea and the
implementation side by side.

---

## 1. Don't trust a checklist more than the code

The whole exercise started from a design-doc checklist claiming things like
"CSRF ❌" and "IDOR ⚠️ (de facto guard, no test suite)". Both turned out to be
wrong in opposite directions once actually checked:

- **CSRF was overstated.** Classic CSRF exploits a browser's _automatic_
  attachment of cookies to requests it didn't mean to send. This app uses
  Bearer tokens in an `Authorization` header, attached manually by JS on every
  request — there's no cookie for a malicious page to piggyback on. A CSRF
  token here would defend against an attack this architecture doesn't have.
- **IDOR was understated.** The "de facto guard" (an auto-scoping database
  wrapper) was used by 2 of 40 services. Its supporting middleware was never
  wired up at all — dead code that, if it _had_ run, would have trusted a
  value the caller could set themselves.

**The general rule:** a security checklist tells you _what to check_, not
_what's true_. "❌" and "✅" are claims about the code, and claims need
evidence — a file, a line number, a command you ran. Grep for the thing;
don't grep for the word describing the thing (a working ✅ SAML config,
found later in the same project, had been marked ❌ purely because a search
for the literal string `"saml"` in the backend came up empty — the real
implementation lived in the frontend, calling a generically-named endpoint).

---

## 2. Multi-tenancy and the "one query away from a data leak" problem

**The concept:** in a multi-tenant app (one deployment, many customers'
data in the same tables), every single database query needs a `WHERE
tenantId = ...` clause, or it silently returns _everyone's_ data mixed
together. There's no natural boundary stopping this — the database doesn't
know "customer A" and "customer B" are supposed to be separate; it's just
rows in a table.

**Two ways to enforce it:**

1. **Manual, per-query.** Every developer, every time, remembers to add
   `tenantId` to `where`. This is what 38 of 40 services in this project
   were doing — it works only as well as the discipline behind it.
2. **Automatic, at the ORM layer.** Wrap the database client so tenantId
   gets injected into every query _for you_, using a value stashed
   somewhere ambient (see §3) instead of passed as a parameter everywhere:

```ts
// packages/db/src/client.ts
export const prisma = prismaRaw.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantContext.getStore()?.tenantId;
        if (tenantId) args.where = { ...args.where, tenantId };
        return query(args);
      },
    },
  },
});
```

**The lesson from this project:** having the automatic version built
doesn't help if almost nothing uses it. `grep -rl "new PrismaClient()"`
found 38 files bypassing the wrapper entirely — each one just as
correct or incorrect as whoever wrote it remembered to be. **Defense in
depth means both**: keep the manual filters (they're the only protection
for code that runs outside a normal web request — see §3), _and_ route
everything through the auto-scoping layer as a backstop.

---

## 3. `AsyncLocalStorage`: how "ambient" context works, and where it breaks

**The problem it solves:** the auto-scoping wrapper above needs to know
"which tenant is this query for," but by the time you're deep inside a
generic database client, you don't have direct access to the original
HTTP request. Passing `tenantId` as an explicit parameter through every
function in the call chain would work, but it's exactly the kind of
threading-a-value-through-everything that gets forgotten.

`AsyncLocalStorage` is Node's answer: a value that's "ambient" for the
duration of an async operation and everything it spawns — set once at the
top, readable anywhere below without being passed explicitly:

```ts
tenantContext.run({ tenantId }, () => {
  // tenantId is invisibly available to anything called from here,
  // no matter how many functions deep, without being a parameter
});
```

**Where this actually gets set matters enormously.** This project has
NestJS's request pipeline: **Middleware → Guards → Interceptors → Route
Handler**. A piece of code sitting in _Middleware_ looking for
`req.user.tenantId` will always find it `undefined`, because `req.user`
doesn't get populated until a _Guard_ runs — which is a later stage.
That's exactly the bug found here: dead middleware that, if it had ever
run, would have derived tenant scope from a client-supplied header
instead of the verified login token, because it was checking the wrong
value at the wrong pipeline stage. The actual correct implementation was
an **Interceptor** (a later stage, after Guards):

```ts
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const tenantId = context.switchToHttp().getRequest().user?.tenantId;
    return new Observable((subscriber) => {
      tenantContext.run({ tenantId }, () => next.handle().subscribe(subscriber));
    });
  }
}
```

**The general rule:** if you're using ambient/thread-local context of any
kind (this pattern exists in most languages — Python's `contextvars`, Go's
`context.Context`, Java's `ThreadLocal`), always check _where in the
request lifecycle_ you're reading the value from, relative to where it's
guaranteed to have been set. "It's set somewhere in this app" is not the
same as "it's set before this specific line runs."

**The other gap this exposes:** background work — queue workers, cron
jobs, event listeners — runs **completely outside** this pipeline. There's
no HTTP request, so there's no Guard, no Interceptor, no ambient
`tenantId` at all. Anything that runs in the background must carry
`tenantId` explicitly as data (a job payload, an event field) and filter
by it manually — the automatic layer simply cannot help there, no matter
how well it's wired up for the request path.

---

## 4. Writing a custom static-analysis script instead of a one-time manual audit

Faced with "check 38 files for a pattern by hand," the better move was
writing a script that checks all of them, permanently, on every future
change — not just once.

**Why AST-based, not regex:** a regex like `/findMany\(/` can't tell you
whether the `where` clause 4 lines later contains `tenantId` — it doesn't
understand code structure, just text. A real parser does:

```ts
import * as ts from 'typescript';
const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

function visit(node: ts.Node) {
  if (ts.isCallExpression(node)) {
    // now you can inspect node.expression (what's being called),
    // node.arguments[0] (the actual argument object), and walk into
    // its properties to check for a `tenantId` key — precisely,
    // not by guessing at surrounding text.
  }
  ts.forEachChild(node, visit);
}
```

**Why false positives matter more than false negatives here:** a script
that cries wolf on safe code gets its output ignored, or worse, gets
disabled. This one treats anything it can't fully verify (a spread
`...filters`, a variable holding the `where` object) as "assume safe"
rather than flagging it — accepting that a clean run isn't a _proof_,
just a floor. Real exceptions get an explicit, greppable escape hatch
instead of a silent skip:

```ts
// tenant-scope-ok: this IS the lookup that determines which tenant the
// caller belongs to — can't pre-filter by a tenantId we don't know yet.
const user = await prisma.user.findFirst({ where: { ssoSubject: payload.sub } });
```

**Result on this project:** 77 candidates on the first run, across 26
files. Manually triaging every one found that ~65 were already safe (a
`findFirst` scoped to `tenantId` a few lines earlier, with a
`NotFoundException` thrown before the flagged line could ever run) — but
**2 were real, previously-undetected, cross-tenant bugs**: a caller could
supply another tenant's warehouse ID and the code would happily read and
write that tenant's stock levels, because the check that _would_ have
caught it (a database uniqueness constraint) didn't include `tenantId` in
its key. A regex scan would very likely have missed this distinction
entirely, either flagging everything (and getting ignored) or missing the
real 2 (no keyword to match on).

**The general rule:** if a category of bug is worth checking for once,
it's usually worth automating the check and running it forever — a
one-time audit only tells you about the code that existed the day you ran
it.

---

## 5. Security headers — what each one actually stops

`helmet()` is one line that sets several headers, each defending against a
_different, unrelated_ attack:

| Header                             | Stops                   | How                                                                                                                                                                                          |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` (HSTS) | Downgrade attacks       | Tells the browser "never use plain HTTP for this site again," even if a link points to `http://`                                                                                             |
| `X-Frame-Options`                  | Clickjacking            | Stops the page being loaded inside a hidden `<iframe>` on an attacker's site, tricking a user into clicking something they can't see                                                         |
| `Referrer-Policy`                  | URL/data leakage        | Controls how much of the current page's URL gets sent to the _next_ site when a user clicks a link away from it (URLs can contain tokens, IDs, search terms)                                 |
| `Content-Security-Policy` (CSP)    | XSS blast radius        | Tells the browser "only run scripts from these sources" — even if an attacker manages to inject a `<script>` tag some other way, the browser refuses to execute it if it violates the policy |
| `Permissions-Policy`               | Unwanted feature access | Disables browser APIs (camera, microphone, geolocation) the app has no legitimate use for, so even a compromised script can't invoke them                                                    |

**Why CSP needed a second, looser policy for two specific routes:**
Swagger UI and Bull Board (an admin dashboard) both render their own
inline `<script>`/`<style>` tags to work at all — a strict "no inline
scripts" policy would break them. Rather than weaken the global policy for
every route to accommodate two of them, the relaxed version is scoped to
just those paths:

```ts
app.use(
  helmet({ contentSecurityPolicy: { directives: { scriptSrc: ["'self'"] /* strict, global */ } } }),
);
app.use(
  ['/api-docs', '/admin/queues'],
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"] /* relaxed, these two routes only */,
      },
    },
  }),
);
```

**The general rule:** default to the strictest policy that works, and
carve out narrow, deliberate exceptions for the specific things that need
them — never loosen the default to make one feature work.

---

## 6. CORS: what "no options" actually means

`app.enableCors()` with zero arguments doesn't mean "CORS is off" — it
means "use the library's default," which for the popular `cors` npm
package is `origin: true`: **reflect and allow whatever origin the caller
sent, unconditionally.** This project had exactly that: any website in the
world could call the API's endpoints from client-side JavaScript.

It wasn't independently exploitable here (nothing sends cookies
cross-site, so there was nothing for a malicious page's browser to
piggyback on — see §1), but it's still worth fixing on its own:

```ts
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());
app.enableCors({ origin: allowedOrigins, credentials: true });
```

**The general rule:** CORS answers "which websites' JavaScript is allowed
to call this API," not "is this API public." An API can be intentionally
public (called directly, via `curl`, mobile apps, server-to-server) while
still restricting _which browser-based frontends_ get to call it — those
are different questions, and "wildcard origin" answers neither of them on
purpose, it's just what happens when nobody set an explicit answer.

---

## 7. Rate limiting: why the storage backend matters

A rate limiter needs to remember "how many requests has this caller made
recently" — and _where_ it remembers that matters as soon as an app runs
on more than one server process:

- **In-memory** (the naive default): each server instance has its own
  counter. Run 3 instances behind a load balancer, and a caller gets 3x
  the intended limit, one third of requests landing on each instance.
- **Redis-backed**: every instance reads/writes the same shared counter,
  so the limit is enforced correctly no matter how many instances are
  running.

```ts
ThrottlerModule.forRootAsync({
  useFactory: (redis: RedisService) => ({
    throttlers: [{ name: 'short', ttl: 1000, limit: 5 }],
    storage: new ThrottlerStorageRedisService(redis), // shared across instances
  }),
});
```

**Sliding window vs. fixed window:** a _fixed_ window ("max 5 requests per
clock-minute") lets a caller send 5 requests at 12:00:59 and another 5 at
12:01:00 — 10 requests in 2 seconds, technically within two separate
"minutes." A _sliding_ window counts requests in the trailing N seconds
from _now_, closing that loophole.

**Route-specific overrides matter too** — a global default is rarely
right for every endpoint. The one route in this app that creates a brand
new tenant (provisioning a real external Keycloak realm per call, and
requiring no login at all) got a much tighter limit than everything else,
because both its cost-per-call and its lack of an auth requirement make it
the single most attractive target for abuse:

```ts
@Throttle({ short: { limit: 2, ttl: 10000 }, medium: { limit: 5, ttl: 60000 } })
@Post()
async createTenant(@Body() dto: CreateTenantDto) { ... }
```

---

## 8. Secrets: "public client" doesn't mean "safe to hardcode"

The codebase had a literal string used as an OAuth client secret, shared
across every tenant, committed to git:

```ts
secret: 'amdox-secret-123', // In prod, generate a secure UUID
```

The client using it was configured as `publicClient: true` — meaning
Keycloak doesn't actually require or validate a secret from it at all
(public clients, like browser SPAs, can't keep a secret hidden from
anyone inspecting network traffic, so the OAuth spec doesn't rely on one
for them). So this specific value wasn't gating anything today. It was
still wrong to leave as a literal:

- **It signals a security debt to anyone reading the code** — "someone
  meant to fix this and didn't," which erodes trust in every other
  security-relevant comment in the codebase.
- **Configuration drifts.** If this client ever became confidential (a
  perfectly normal refactor), a hardcoded shared secret would suddenly
  matter, and by then it's already been sitting in git history for months.
- **It's trivially easy to generate correctly instead:**

```ts
import { randomUUID } from 'crypto';
secret: randomUUID(), // unique per tenant, not shared, not committed
```

**The general rule:** "it's not exploitable right now" and "it's fine to
commit" are different claims. Secrets — even ones that happen not to be
load-bearing today — belong in environment variables or generated at
runtime, not as literals in source control, because the _reason_ they're
safe today is a fact about today's configuration, not a property of the
value itself.

---

## 9. CI security scanning: three different questions, three different tools

"Scan for security problems" isn't one check — it's several, each looking
for a different category of mistake:

| Tool class                              | Question it answers                                                      | Example finding                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Secret scanner (TruffleHog, gitleaks)   | Did anyone commit a real credential?                                     | An AWS key accidentally pasted into a commit, even one later "removed" (it's still in git history) |
| Dependency scanner (Grype, `npm audit`) | Do any of my dependencies have a known vulnerability?                    | A transitive package with a published CVE for remote code execution                                |
| Container scanner (Trivy)               | Does my built image contain vulnerable OS packages or bad configuration? | A base image with an outdated OpenSSL that has a known exploit                                     |

None of these substitute for the others — a project can have zero
committed secrets, perfectly safe dependencies, _and_ a container image
built on a base OS with three months of unpatched CVEs. Running all three
in CI means each class of mistake gets caught the moment it's introduced,
not discovered later during an incident.

**Practical note on gating vs. blocking:** prefer scanners that run
without external accounts or tokens (Grype is free/OSS and needs no
signup) so the dependency scan actually executes on every push instead
of silently skipping when a secret like `SNYK_TOKEN` was never
configured. Fail only on fixable high/critical findings so CI blocks
real risk without noise from unpatched upstream packages:

```yaml
- name: Run Grype
  uses: anchore/scan-action@v7
  with:
    path: '.'
    fail-build: true
    severity-cutoff: high
    only-fixed: true
```

---

## 10. The most important lesson: prove it against the real system

Three separate times in this session, the _first_ plausible explanation
was wrong, and only running the actual thing revealed it:

- **A file that looked like the live security mechanism was dead code.**
  `tenant-context.middleware.ts` had exactly the right name and did
  exactly the wrong thing — reading `req.user` before it could possibly be
  set. It was tempting to just "fix" its logic. Checking whether anything
  actually called it (`grep` for `.configure()`/`app.use()`) revealed it
  was never wired up at all — a different file was doing the real work
  correctly the whole time. Fixing the dead file's logic would have been
  effort spent on code that never ran.

- **A "fixed" cross-tenant bug needed an actual attack to prove.** Adding
  an ownership check is easy to write and easy to convince yourself is
  correct by reading it. Only firing a real request — a valid token from
  tenant A, paired with tenant B's warehouse ID — and confirming both the
  `404` response _and_ a zero-row count in tenant B's database proved the
  fix actually closed the hole, rather than just looking like it should.

- **A CI pipeline that looked complete would have failed on day one for
  an unrelated reason.** `apps/web`'s typecheck had a pre-existing
  failure from a `react-grid-layout` major-version type change, sitting
  there before this work even started. Wiring the typecheck step into a
  brand-new CI pipeline without running it locally first would have
  shipped a pipeline that goes red immediately — for a bug this session
  didn't cause and initially had nothing to do with. Running every job's
  command locally _before_ committing the workflow file caught it while
  it was still cheap to fix.

**The pattern underneath all three:** "this looks right" and "I traced
the logic and it should work" are hypotheses, not verification. The
questions that actually settle them are concrete and checkable — _is this
function ever called anywhere? What does the database actually contain
after this runs? Does this command succeed if I run it right now?_ — and
they're worth asking even when (especially when) the code already looks
correct on read.
