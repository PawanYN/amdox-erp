# Day 24 continued — Slack Notifications & Real CI Failure Triage

Companion to `docs/learning/day24-gitops-argocd-smoke.md` (ArgoCD + smoke
tests). This doc covers the last Day 24 bullet — Slack notifications — and
the real debugging session that followed the moment it went live: the very
first CI failure Slack reported was a genuine bug hunt, not a false alarm.

---

## 1. Wiring Slack — two separate pipes, one webhook

A Slack **incoming webhook** is a secret URL: anything POSTed to it appears as
a message in one pre-chosen channel. Treat the URL like a password — anyone
holding it can post to that channel.

The webhook feeds **two independent systems**, each notifying about a
different thing:

| Pipe                               | Notifies about                       | Where the URL lives                                                      |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| GitHub Actions (`ci.yml`)          | Did lint/typecheck/build/scans pass? | GitHub repo secret `SLACK_WEBHOOK_URL`                                   |
| ArgoCD (`argocd-notifications-cm`) | Did the GitOps sync to prod succeed? | Kubernetes secret `argocd-notifications-secret`, key `slack-webhook-url` |

**CI side** — a final `notify` job in `ci.yml`, `needs:` every other job and
`if: always()` (so it reports failures too, not just green runs), plain
`curl` against the webhook (no third-party marketplace action to trust).

**ArgoCD side** — a generic `service.webhook.slack` in the notifications
ConfigMap, two message templates (`slack-sync-succeeded` /
`slack-sync-failed`), two triggers watching `app.status.operationState.phase`,
and the `amdox-prod` Application subscribed via annotations
(`notifications.argoproj.io/subscribe.on-sync-succeeded.slack: ''`). The
actual webhook URL was set directly with `kubectl patch secret` — deliberately
run by the user, not by an assistant, so the secret never passed through a
committed file or a chat transcript.

**First real signal:** minutes after wiring this up, a genuine CI failure
notification landed in Slack — proof the whole pipe works, and also the
start of a real debugging session (below).

---

## 2. What actually broke, and why

The failing run showed 4 red jobs. Two turned out to be one root cause each;
all three were real, pre-existing gaps, not flakes.

### 2a. Typecheck failed with dozens of "no exported member" errors

```
error TS2305: Module '"@amdox/db"' has no exported member 'InvoiceStatus'.
error TS2305: Module '"@amdox/db"' has no exported member 'LeaveStatus'.
... (20+ more, all Prisma enums)
```

**Why:** `@amdox/db`'s `package.json` had `"build": "tsc"` — it compiled the
hand-written TypeScript but never ran `prisma generate`, the step that reads
`schema.prisma` and writes the actual `PrismaClient` types (including every
enum). Locally this had been masked for ages because `node_modules/` already
had a generated client sitting around from some earlier `prisma generate`
run. A clean CI checkout has no such leftover — so CI was the first place this
gap was ever exercised for real.

**Fix:** one line — `"build": "prisma generate && tsc"`.

**Lesson:** a monorepo package that wraps a code generator must run the
generator as part of _its own_ build, not rely on a step some other package
happened to run earlier in the session.

### 2b. All three Trivy scan jobs failed with a resolver error

```
Unable to resolve action `aquasecurity/trivy-action@0.24.0`, unable to find version `0.24.0`
```

**Why:** the upstream `trivy-action` repo re-tagged its releases with a `v`
prefix (`v0.36.0` instead of bare `0.24.0`) and removed the old bare tags —
an upstream breaking change, unrelated to anything in this repo.

**Fix:** bump the pin to `aquasecurity/trivy-action@v0.36.0` in both places it
appears (`container-scan` and the `image-scan` matrix job).

**Lesson:** a pinned third-party Action version can go stale on its own, with
zero code changes on your side — worth remembering next time a workflow that
"hasn't been touched" suddenly fails.

### 2c. The ml-service image scan still failed after the version bump — a _new_ CVE

```
libgssapi-krb5-2  CVE-2026-40355  HIGH  fixed  1.20.1-2+deb12u4 → 1.20.1-2+deb12u5
libgssapi-krb5-2  CVE-2026-40356  HIGH  fixed  1.20.1-2+deb12u4 → 1.20.1-2+deb12u5
(+ libk5crypto3, libkrb5-3, libkrb5support0 — same two CVEs)
```

This one was a **real, live finding** — not infrastructure noise — so it got
the same triage discipline as the existing `.trivyignore` entries, not a
reflex ignore:

1. **Is this actually unfixable by us?** The base image is
   `gcr.io/distroless/python3-debian12` — distroless images ship no shell, no
   package manager, so there is no `apt upgrade` to run inside the final
   image.
2. **Has upstream already fixed it?** Pulled `gcr.io/distroless/python3-debian12:latest`
   fresh and scanned it directly — still shipped the same unpatched
   `deb12u4` packages. Confirmed genuinely blocked upstream, not just stale in
   our pinned digest.
3. **Time-box it, don't silence it forever.** Added to `.trivyignore` with an
   `exp:2026-08-08` date, following the file's own stated policy ("every
   entry MUST carry an exp: date... Do not add entries without an expiry") —
   so if distroless still hasn't rebuilt by then, the scan goes red again
   automatically instead of silently staying green forever.
4. **Verify the fix locally before pushing.** Rebuilt the ml-service image and
   re-ran `trivy image --ignorefile .trivyignore` locally — clean exit 0 —
   before committing.

---

## 3. A red herring: GitHub's own outage

After both fixes were pushed, the new CI run sat `pending`/`queued` for over
ten minutes with **zero jobs started** — long enough to suspect something
broken in the repo (a concurrency-group deadlock, a billing limit, disabled
Actions). Each was checked and ruled out in order:

- `actions/permissions` → enabled, all actions allowed.
- Repo visibility → public, so no private-repo minutes cap applies.
- Self-hosted runners → none configured (uses GitHub-hosted `ubuntu-latest`,
  as expected).
- The _old_ run's leftover `notify` job was still queued too, suggesting a
  shared cause rather than something specific to the new push.

Only then — **checking `githubstatus.com` directly** — did the real
explanation turn up: GitHub had an active, acknowledged incident, "Delays
starting Actions runs," describing exactly this symptom (~5% of GitHub-hosted
runs delayed 5+ minutes, some failing outright). Nothing to fix; the run
started on its own once the incident eased, and finished **10/10 jobs
green**, Slack notification included.

**Lesson:** when something that "shouldn't be able to fail" hangs with zero
progress, check the vendor's own status page before assuming the bug is
yours — but only _after_ ruling out the checks you actually control (config,
permissions, quota). Both matter: don't skip your own checks, but don't loop
on them forever when the evidence points outward.

---

## Poking at it

```bash
# GitHub side
gh secret list -R <owner>/<repo>                      # SLACK_WEBHOOK_URL present?
gh run view <run-id> --json jobs -q '.jobs[] | "\(.status)\t\(.conclusion)\t\(.name)"'
cat .trivyignore                                       # every entry has an exp: date

# ArgoCD side
kubectl -n argocd get configmap argocd-notifications-cm -o yaml | grep -A3 slack
kubectl -n argocd get secret argocd-notifications-secret -o jsonpath='{.data}' # key present, value hidden

# Reproduce the CI typecheck step locally, exactly as ci.yml runs it
pnpm --filter @amdox/db run build && pnpm --filter api exec tsc --noEmit

# Reproduce the image scan locally
docker build -f apps/ml-service/Dockerfile -t amdox-ml-service:ci apps/ml-service
trivy image --severity CRITICAL,HIGH --ignore-unfixed --ignorefile .trivyignore amdox-ml-service:ci
```

## Still open

- Nothing left on the Day 24 checklist except what was always going to need a
  human: no further Slack/CI/GitOps work is blocked.
- Watch the `.trivyignore` `exp:2026-08-08` entries — if `gcr.io/distroless/*`
  still hasn't rebuilt against patched `openssl`/`python3.11`/`krb5` by then,
  the relevant scan jobs will go red again on purpose.
