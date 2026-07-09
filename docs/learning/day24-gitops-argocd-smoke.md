# Day 24 — GitOps with ArgoCD & Post-Deployment Smoke Tests, in Simple Language

Companion to the Day 24 checklist in `team_assignment.md`, written the way it
was taught in-session. The CI half (`.github/workflows/ci.yml`) was already
done; this covers the CD half built on the Day 23 kind cluster.

---

## 1. CI vs CD, in one breath

**CI** = every push, a robot _checks_ the code (lint, typecheck, tenant audit,
build, security scans). **CD** = if the checks pass, a robot _ships it_. Day 24
closed the shipping robot — locally, on the kind cluster.

## 2. GitOps — the deploy button is `git push`

The old way (Day 23): a human runs `helm upgrade` at the cluster. Push-based,
manual, unlogged.

The GitOps way: a robot **inside the cluster** (ArgoCD) continuously pulls the
git repo and asks one question: _"does the cluster match what git says?"_ If
not, it fixes the cluster. Nobody deploys; everybody commits.

- **The contract** is one file, `infra/argocd/amdox-prod.yaml`: "namespace
  `amdox-prod` = whatever `infra/helm/amdox` renders with `values-prod.yaml`
  at this git revision."
- **Rollback** = `git revert`. **Audit trail** = `git log`.
- `prune: true` — delete cluster objects whose manifests left git.
- `selfHeal: true` — revert manual `kubectl` edits. _Git wins, always._

**The three proofs run against live prod:**

1. **Rebuild from nothing.** The hand-made helm release was uninstalled; ArgoCD
   recreated the entire namespace from git alone — sealed secrets unsealing and
   all.
2. **Deploy by commit.** `THROTTLE_MEDIUM_LIMIT: 600 → 900` committed to
   `values-prod.yaml`; the live ConfigMap read `900` with no kubectl/helm run.
   (Reverted the same way afterwards — the revert also deployed itself.)
3. **Git beats humans.** A rogue `kubectl patch` set the value to `555`;
   selfHeal put it back within ~20 seconds.

**Honest caveat:** the Day 23/24 branches aren't pushed to GitHub, so ArgoCD
watches a _local_ mirror — a container on the kind docker network running
git's real server component (`git-http-backend`), because ArgoCD speaks git's
"smart" HTTP protocol and refuses a plain file server. A real setup swaps the
`repoURL` to the GitHub URL and `targetRevision: main`.

## 3. Smoke tests — "did the deploy obviously break something?"

Named after plugging in a new device and watching for smoke. Not a test suite —
a tripwire: api `/health/live`, api `/health/ready` (proves the DB connection),
web `/`, ml `/health`.

The k8s-native trick: the test is a **Job inside the Helm chart**
(`templates/smoke-test.yaml`) marked as a _hook_:

- `argocd.argoproj.io/hook: PostSync` — ArgoCD runs it after **every sync**; a
  red smoke test marks the sync Failed, visibly.
- `helm.sh/hook: post-install,post-upgrade` — plain-helm environments
  (dev/staging) get the same behavior from the helm CLI.
- `sidecar.istio.io/inject: "false"` — a Job pod with an Envoy sidecar never
  completes (the proxy outlives the test), so injection is opted out.

Verified in prod: `Complete 1/1` in 8s, all four checks green.

## 4. The two gotchas worth remembering

1. **Hooks are not desired state.** A commit that _only adds a hook_ changes
   nothing about what should exist in the cluster, so ArgoCD stays "Synced,"
   no sync operation fires, and the hook silently never runs. Hooks run on the
   next _manifest-changing_ commit.
2. **selfHeal syncs skip hooks** (by design — a drift-fix shouldn't rerun your
   tests), and with automated sync enabled, a manually-triggered re-sync of the
   _same revision_ can be superseded by such a hook-skipping sync — which then
   reports "successfully synced," green and misleading. Both were hit live and
   diagnosed from the application controller's logs (`skipHooks=true`).

## 5. Still open

- **Slack notifications** — one webhook URL from the team's Slack workspace
  unlocks both `ci.yml` notifications and ArgoCD's own notifications
  controller (already installed).
- **docker push + deploy steps in CI** — need a registry and a persistent
  cluster (PLAT-01); GitHub's runners can't reach a kind cluster on a laptop.

## Poking at it

```bash
kubectl get pods -n argocd                              # the robot itself
kubectl get application amdox-prod -n argocd            # Synced / Healthy?
kubectl describe application amdox-prod -n argocd | tail -30
kubectl get jobs -n amdox-prod                          # last smoke test
kubectl logs job/amdox-smoke-test -n amdox-prod         # its checks
docker ps | grep amdox-git-mirror                       # the local "GitHub"
# UI (admin password):
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
