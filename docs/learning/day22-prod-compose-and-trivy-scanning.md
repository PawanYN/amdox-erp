# Day 22 (part 2): Production docker-compose & Trivy Image Scanning in CI

_A learning doc — written while closing the last two Day 22 items, so future-me
can re-learn every concept from the actual work, including the things that
went wrong._

**The two tasks:**

1. `docker-compose.prod.yml` with health checks and resource limits (the file
   existed but was empty)
2. Container image scanning with Trivy in the CI pipeline

---

## Part 1 — What makes a compose file "production"?

The dev file (`infra/docker/docker-compose.yml`) only runs _infrastructure_ —
Postgres, Redis, Keycloak, Elasticsearch, the ML service. The api and web apps
run on the host via `pnpm dev`. A production file must run **everything as
containers**, and it must be _safe by default_. Five ideas separate prod from
dev:

### 1.1 No default passwords — `${VAR:?}` required variables

Dev compose does this:

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:-amdox_dev_123} # ":-" = fallback default
```

Prod compose does this:

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required} # ":?" = hard error
```

The `:?` syntax makes `docker compose` **refuse to start** with a clear error
message if the variable isn't set. A prod stack should never be able to come
up with `admin/admin`. We verified this behaviour: running
`docker compose config` without the env vars fails with
`required variable KEYCLOAK_ADMIN_PASSWORD is missing a value`.

### 1.2 Health checks in distroless images (the tricky part)

A health check is a small command Docker runs _inside_ the container every N
seconds; if it keeps failing, the container is marked `unhealthy`.

Problem: our api/web/ml images are **distroless** — no shell, no `curl`, no
`wget`. A normal `test: ["CMD-SHELL", "curl -f http://localhost/health"]`
cannot work because neither `sh` nor `curl` exists in the image.

Solution: exec the _one binary the image does have_ — its own language
runtime:

```yaml
# Node distroless (api/web) — node has fetch() built in since v18:
test: ["CMD", "/nodejs/bin/node", "-e",
       "fetch('http://localhost:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Python distroless (ml-service):
test: ["CMD", "/usr/bin/python3", "-c",
       "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8091/health').status==200 else 1)"]
```

Note `CMD` (exec directly) vs `CMD-SHELL` (wrap in `sh -c`) — distroless
images can only use `CMD`.

Bonus gotcha found along the way: **Keycloak 25 moved its `/health/*`
endpoints to a separate "management interface" on port 9000**, not the main
8080 — and the Keycloak image also has no curl, so the check uses a pure-bash
trick (`exec 3<>/dev/tcp/host/port`) to speak HTTP over a raw socket.

### 1.3 Startup ordering — `depends_on` with `condition: service_healthy`

Plain `depends_on` only waits for the container to _start_, not to be _ready_.
Combined with health checks you get real ordering:

```yaml
api:
  depends_on:
    api-db: { condition: service_healthy }
    redis: { condition: service_healthy }
    keycloak: { condition: service_healthy }
```

The API container is not even created until Postgres, Redis and Keycloak all
report healthy. This kills a whole class of "app crashed because DB wasn't up
yet" restart loops.

### 1.4 Resource limits — `deploy.resources`

```yaml
deploy:
  resources:
    limits: # hard cap — container is throttled/OOM-killed above this
      cpus: '1.0'
      memory: 1g
    reservations: # guaranteed minimum — scheduler keeps this much free for it
      memory: 256m
```

Without limits, one leaking service (usually Elasticsearch or a JVM) eats all
host memory and the kernel OOM-killer shoots something random — often your
database. With limits, the blast radius is one container. Our totals cap at
~7 GB so the stack can't take down the host.

### 1.5 Small but important prod details

- `name: amdox-prod` at the top → volumes/networks get an `amdox-prod_`
  prefix, so prod data can never collide with dev data even on the same
  machine.
- Keycloak runs `start` (production mode) instead of `start-dev`.
- **Only user-facing ports are published** (web 3000, api 3001, Keycloak
  8180). Postgres/Redis/Elasticsearch are reachable only on the internal
  Docker network — not from the host or the internet.
- `NEXT_PUBLIC_*` values are **build args, not runtime env** — Next.js inlines
  them into the client JS bundle at build time. Changing them means
  _rebuilding_ the web image, not restarting it. Easy to forget.

**Validation without starting anything:**

```bash
DB_PASSWORD=x ... docker compose -f infra/docker/docker-compose.prod.yml config --quiet
```

`config` parses, interpolates variables and validates the whole file — a
compile check for compose files.

---

## Part 2 — Trivy image scanning in CI

### 2.1 Filesystem scan vs image scan (they are NOT the same)

CI already had a Trivy **filesystem scan** (`scan-type: fs`) — it reads
lockfiles and config _in the repo_. What it can never see: the **OS packages
inside the built image** (openssl, zlib, python3.11 from the base image…).
Only an **image scan** (`trivy image <tag>`) sees those, because it unpacks
the actual image layers. You want both.

### 2.2 The CI job — a build+scan matrix

We replaced the single hardcoded ml-service scan (which had a stale comment
claiming api/web "have no production Dockerfile yet" — they do since Day 22)
with a **matrix job**: one parallel runner per image.

```yaml
strategy:
  fail-fast: false # one image failing shouldn't cancel the others
  matrix:
    include:
      - { service: api, dockerfile: infra/docker/Dockerfile.api, context: . }
      - { service: web, dockerfile: infra/docker/Dockerfile.web, context: . }
      - { service: ml-service, dockerfile: apps/ml-service/Dockerfile, context: apps/ml-service }
```

Each runner builds with `docker/build-push-action` using:

- `push: false, load: true` — build locally on the runner, never push anywhere
- `pull: true` — always re-pull base images (see §3.4 for why this matters)
- `cache-from/to: type=gha` — Docker **layer cache stored in GitHub's cache
  service**, so the huge `pnpm install` layer is reused across CI runs instead
  of rebuilt every time

…then scans with `exit-code: '1'` on CRITICAL/HIGH so findings actually fail
the pipeline.

### 2.3 The golden rule: verify the gate locally BEFORE pushing it

A CI gate you've never run is a guess. We installed Trivy locally, built all
three images, and ran **the exact same scan CI would run**. Result: the gate
as first written **would have failed on its very first run** — the ml-service
image alone had 29 HIGH/CRITICAL findings. Everything in Part 3 came out of
that dry run.

---

## Part 3 — Problems faced, and how each was solved

### 3.1 `permission denied ... /var/run/docker.sock`

First build attempt failed instantly. Diagnosis: `ls -l /var/run/docker.sock`
showed `root:docker`, and `groups` showed our user wasn't in the `docker`
group. Fix: `sudo usermod -aG docker ubuntu` (takes effect on next login;
until then, `sudo docker ...`).

**Lesson:** when a tool "isn't working", check _permissions on the socket/file
it talks to_ before assuming the tool is broken. Also: an exit code of 0 from
a wrapper script doesn't mean the inner command succeeded — read the log.

### 3.2 29 findings, but most were unfixable — `--ignore-unfixed`

The raw scan of ml-service: 29 OS findings. Reading them: most were Debian
`will_not_fix` CVEs — e.g. a zlib CVE in code Debian doesn't even ship.
**There is no action anyone can take on these.** A gate that fails on
unfixable findings is permanently red, and a permanently red gate trains
everyone to ignore it — worse than no gate.

Fix: `--ignore-unfixed` (CI: `ignore-unfixed: true`) — only count CVEs where
a _patched version exists_. 29 findings → 4 actionable ones. This is the
standard policy for Debian/distroless-based images.

### 3.3 Vulnerable npm packages nobody installed — transitive deps & pnpm overrides

The api image contained `lodash 4.17.21` (arbitrary-code-execution CVE) and
`multer 2.1.1` (DoS CVE). Neither is in any of our `package.json`s — they're
**transitive**: dependencies of dependencies.

Tracing them (`pnpm why lodash --filter api`, then grepping `pnpm-lock.yaml`):

- `multer` came via `@nestjs/platform-express`
- old `lodash` was pinned by `openapi-to-postmanv2` — a _dev_ dependency that
  survived `pnpm prune --prod` as an orphan in the pnpm store

You can't edit someone else's package.json, so the fix is **pnpm overrides**
in the root `package.json` — force a version across the whole tree, whatever
any intermediate package asks for:

```json
"pnpm": {
  "overrides": {
    "lodash@<4.18.0": "4.18.1",
    "multer@<2.2.0": "2.2.0"
  }
}
```

Then `pnpm install` regrew the lockfile with zero references to the old
versions. Rebuild → api npm findings: 0.

### 3.4 Stale base images — why `pull: true` exists

Several "fixable" OS CVEs (old `libssl3`, old `python3.11`) were simply
because our **locally cached base images were weeks old**. `docker build`
happily reuses a cached `FROM` image forever. `docker build --pull` (or
`pull: true` in the action) re-checks the registry for a newer base. CI
runners are fresh so they mostly get this for free — but the flag makes it
explicit and protects against self-hosted runner caches too.

### 3.5 The vendored-copy trap — upgrading a package that's hiding inside another

After adding `RUN pip install --upgrade wheel jaraco.context` to the
ml-service Dockerfile, the scan STILL reported the old versions. Investigating
inside the image found why:

```
/opt/venv/site-packages/wheel-0.47.0.dist-info                      ← our upgrade ✅
/opt/venv/site-packages/setuptools/_vendor/wheel-0.45.1.dist-info   ← still there ❌
```

`setuptools` ships private **vendored copies** of its dependencies inside
`setuptools/_vendor/`. Upgrading the standalone package doesn't touch them —
you must upgrade the _vendoring_ package itself:

```dockerfile
RUN pip install --no-cache-dir --upgrade setuptools wheel jaraco.context
```

After that: vendored wheel → 0.46.3 (patched), vendored jaraco.context gone
entirely (newer setuptools stopped vendoring it).

**Lesson:** when a scanner keeps reporting a version you're sure you upgraded,
look at the _file path_ of the finding — it tells you which copy it found.

### 3.6 CVEs that literally cannot be fixed _today_ — `.trivyignore` with expiry

Final scan still failed on 6 OpenSSL CVEs + 1 Python CVE. Debian shipped the
patched packages days ago, but **Google hasn't rebuilt the distroless images
against them yet** — we even pulled `distroless/nodejs22` to check: same stale
libssl. Nobody outside Google can fix this today.

Wrong answers: turn the gate off, or ignore the CVEs forever. Right answer —
**time-boxed ignores**:

```
# .trivyignore
CVE-2026-31789 exp:2026-08-08
CVE-2026-45447 exp:2026-08-08
...
```

Trivy honors the `exp:` date: after 2026-08-08 the ignore lapses on its own
and CI goes red again _if_ upstream still hasn't shipped. An ignore that
never expires is a permanent blind spot; one with an expiry is a tracked,
self-reopening TODO. The file is wired into CI via `trivyignores: .trivyignore`.

### 3.7 Don't just scan — smoke test

Upgrading `setuptools` inside the ml venv is the kind of change that can break
a Python app at _runtime_ (packages that use `pkg_resources`, etc.) while
every scan stays green. So the last verification was actually running it:

```bash
docker run -d --rm --name ml-smoke -p 18091:8091 amdox-ml-service:ci
curl -sf http://localhost:18091/health   # → {"status":"ok","service":"ml-service"}
```

Green scan + running app = actually done.

---

## The final state

| Image            | Before (raw scan)          | After (CI policy) |
| ---------------- | -------------------------- | ----------------- |
| amdox-ml-service | 29 OS + 2 Python HIGH/CRIT | **PASS**          |
| amdox-api        | 6 OS + 3 npm HIGH/CRIT     | **PASS**          |
| amdox-web        | 6 OS HIGH/CRIT             | **PASS**          |

Real vulnerabilities fixed (not ignored): lodash CVE-2026-4800 (RCE), multer
CVE-2026-5079 (DoS), wheel CVE-2026-24049, jaraco.context CVE-2026-23949.
Time-boxed: 7 upstream-blocked base-image CVEs, expiring 2026-08-08.

## Cheat sheet

```bash
# validate a compose file without starting anything
docker compose -f <file> config --quiet

# scan an image exactly like our CI does
trivy image --severity CRITICAL,HIGH --exit-code 1 --scanners vuln \
  --ignore-unfixed --ignorefile .trivyignore <image:tag>

# who pulls in this dependency?
pnpm why <pkg> --filter <workspace>

# rebuild with fresh base images
docker build --pull ...
```

**The one-sentence takeaway:** a security gate is only real if you've watched
it pass _and_ fail locally — and every finding gets exactly one of three
treatments: fix it (patch exists, in our control), `--ignore-unfixed` (no
patch exists anywhere), or a **dated** `.trivyignore` entry (patch exists,
blocked on someone upstream).
