# Day 23 — Sealed Secrets, Namespace Isolation & Istio Canary, in Simple Language

Companion to the Day 23 checklist in `team_assignment.md`. The chart itself is in
`infra/helm/amdox/`; this doc explains the three concepts that closed the day,
the same way they were taught in-session.

---

## 1. Sealed Secrets — scrambled passwords in git, real passwords only in the cluster

**The problem.** The app needs passwords (database URL, JWT secret). Kubernetes
holds them in a `Secret`, but a Secret file in git is a leaked password — base64
is _encoding_, not encryption. So until now every install needed the values typed
by hand (`--set api.secrets.JWT_SECRET=...`), and worse, `helm get values`
happily printed them all back in plaintext.

**The idea: a mailbox with a slot.** 📬

- Anyone can _drop a letter in_ (encrypt a value) — that's the **public key**.
- Only the person with the _mailbox key can take letters out_ (decrypt) — that's
  the **private key**, held by one program in the cluster: the
  **sealed-secrets controller**. The key never leaves the cluster.

**The flow.**

1. `kubeseal` scrambles each real value into a blob (`AgB8p7N8...`).
2. The blobs are committed in `values-{dev,staging,prod}.yaml` — safe, because
   nobody can unscramble them except the controller.
3. On deploy, the blobs land as a `SealedSecret` object; the controller decrypts
   it and creates the real `Secret` next to it. The app pods notice nothing.

**The safety stamp.** Each blob is bound to _where it may be used_ — the secret
name **and namespace** ("strict scope"). A dev blob pasted into prod is refused.
That's why each environment sealed its own blobs; there was no way to cheat.

**How it was proven.** The old hand-typed Secret was deleted by the upgrade, the
controller logged `Unsealed successfully`, and a **restarted api pod passed its
readiness probe** — which requires a working decrypted `DATABASE_URL`. Wrong
decryption ⇒ no ready pod. To rotate a value, see the comment block at the top
of `values-dev.yaml`.

---

## 2. Namespace isolation — three apartments in one building

A namespace is a labeled folder inside the cluster; things in one folder are
invisible to the others. We installed the app **three times** from the **same
chart** — `amdox-dev`, `amdox-staging`, `amdox-prod` — each with its own api,
web, ml-service, Postgres, Redis and Keycloak. Nothing is shared.

- **Why names don't collide:** names only need to be unique _inside_ a
  namespace. All three databases are called `amdox-postgres`; when staging's api
  asks for `amdox-postgres`, DNS answers with _the one in its own namespace_ —
  like "go to the kitchen" said inside one of three houses.
- **What differs per env** lives in a small values file: hostnames, that env's
  sealed secrets, and for prod: `minReplicas: 2` for api/web, which is what makes
  the PDB's `minAvailable: 1` a real promise during node drains.
- **One receptionist:** a single nginx ingress reads the requested hostname
  (`api-staging.amdox.local` vs `api-prod.amdox.local`) and walks the request to
  the right apartment.

**How it was proven.** Each namespace's `JWT_SECRET` is different, and the
routing was shown to reach the _right_ env — a staging browser `Origin` was
accepted only by staging's api (its CORS allowlist) and rejected by dev's and
prod's. Also fixed for real: all three in-cluster databases had **zero tables**
(readiness only pings the DB!); `prisma db push` gave each its 66-table schema
(`migrate deploy` can't build a fresh DB — our migrations start mid-project with
`ALTER`s, no baseline).

---

## 3. Istio canary — 90% old version, 10% new, with receipts

**The problem.** A plain Kubernetes Service is a dumb doorman: it spreads
traffic evenly over its pods, full stop. A rolling update is therefore
all-or-nothing — if v2 is broken, everyone gets v2. What you want is _"10% get
the new version; watch; then promote."_ That 10% is the **canary** (as in the
coal mine).

**What Istio is.** A _service mesh_: it plants a small proxy (the **Envoy
sidecar**) inside every pod — that's why staging pods show `2/2` — and all
traffic passes through these proxies. Because Istio programs every proxy, it can
enforce rules plain Kubernetes can't, like percentage splits.

**The two rule objects** (both in `templates/istio.yaml`):

| Object            | Job        | In one line                                                            |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| `DestinationRule` | _labeling_ | "api pods come in two groups: `version: stable` and `version: canary`" |
| `VirtualService`  | _routing_  | "send 90% of amdox-api traffic to stable, 10% to canary"               |

Plus `templates/api-deployment-canary.yaml`: a second, fixed-size api Deployment
labeled `version: canary`, running the candidate image tag
(`istio.canary.tag`) while stable keeps the old one. Everything is double-gated
behind `istio.enabled` / `istio.canary.enabled` so non-Istio clusters render
nothing unusual — important because _without_ Istio a canary pod would get its
even Service share, the exact behavior canaries exist to avoid.

**How it was proven with numbers.** A sidecar-injected client pod fired 1,000
requests at `http://amdox-api:3001` inside staging. Envoy's own counters
(`istio_requests_total`, split by `destination_canonical_revision`) read:

```
stable 889   canary 111     → 88.9% / 11.1% against a 90/10 target
```

`istioctl analyze -n amdox-staging` is clean (after giving the dev-dependency
Services protocol-prefixed port names, e.g. `tcp-postgres` — Istio's IST0118
convention).

**Promotion path:** flip `api.tag` to the new tag, set
`istio.canary.enabled: false`, upgrade — stable is now the new version and the
canary Deployment disappears; the VirtualService pins 100% to stable.

---

## Poking at it

```bash
kind get clusters                                  # the cluster: amdox
helm list -A                                       # one release per namespace
kubectl get pods -n amdox-staging                  # 2/2 = Envoy sidecar inside
kubectl get sealedsecrets,secrets -n amdox-dev
kubectl get vs,dr -n amdox-staging                 # VirtualService/DestinationRule
istioctl analyze -n amdox-staging
# ingress (cluster has no host port mapping; go via the node container):
NODE_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' amdox-control-plane)
curl -H "Host: api-staging.amdox.local" http://$NODE_IP:31914/health/live
```

## Honest gaps

- In-cluster Keycloaks have **no realms** (`/realms/amdox-erp` → 404 in all
  three namespaces) — login flows still need the docker-compose stack until
  `scripts/keycloak/setup-keycloak.sh` is run against them.
- The kind cluster was created without 80/443 port mappings, so ingress is
  reached via the node container IP + NodePort, not `localhost`.
- ArgoCD (deploying this chart via GitOps) is Day 24 scope and still open.
