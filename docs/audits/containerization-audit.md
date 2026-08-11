# Amdox ERP — Containerisation (PLAT-05 prep / Day 22)

**Started:** 2026-07-07
**Trigger:** `docs/planning/team_assignment.md`'s Day 22 section listed multi-stage Dockerfiles as ❌ — `infra/docker/Dockerfile.api`, `Dockerfile.web`, and `Dockerfile.ml` were all 0-byte empty dead files, and the one real ML Dockerfile (`apps/ml-service/Dockerfile`) was single-stage `python:3.11-slim`, not distroless. This document records what was built, the real bugs it surfaced, and how each image was verified against the live stack (not just built).
**Status:** All 4 items done and verified — multi-stage Dockerfiles for all 3 services, `docker-compose.prod.yml` (health checks + resource limits, 343 lines), and Trivy CI image scanning (`.github/workflows/ci.yml`'s `image-scan` job). See §6 below.

---

## 1. How to read this doc

Each service section covers: what was written, what broke on the first attempt, the fix, and the live evidence used to confirm it actually works — not just that `docker build` exits 0. Two of the three images hit real bugs that a build-only check would never have caught; both are recorded here so they don't get silently reintroduced.

---

## 2. `infra/docker/Dockerfile.api` (NestJS)

**Approach:** `turbo prune api --docker` to shrink the pnpm/turbo monorepo down to just `api` + its one workspace dependency (`@amdox/db`), install + build in a single stage, `pnpm prune --prod` to drop devDependencies, then copy only the pruned output into `gcr.io/distroless/nodejs20-debian12`.

### 2.1 Bug found: Prisma engine built for the wrong OpenSSL target

First boot crashed immediately:

```
PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x".
This happened because Prisma Client was generated for "debian-openssl-1.1.x"...
```

`node:20-slim` has no `openssl` binary, so Prisma's `generate` step couldn't detect the real OpenSSL version at build time and silently defaulted to `openssl-1.1.x`. The distroless runtime (Debian 12) only ships OpenSSL 3.x, so the downloaded engine binary could never load — this would have crashed the container on every single boot in any real deployment.

**Fix:** install `openssl` in the builder stage (`apt-get install -y --no-install-recommends openssl`) purely so Prisma's own detection logic works correctly; it's never shipped to the runtime image.

### 2.2 Bug found: nonroot couldn't write `openapi-spec.json` on boot

`main.ts` writes `openapi-spec.json` to `process.cwd()` on every startup (for Postman collection generation). A `WORKDIR /app/apps/api` declared before the `COPY` steps gets created as `root:root` by Docker even though the files copied into it afterward were `--chown=nonroot:nonroot` — the directory entry itself stays root-owned, so `nonroot` can create files inside subdirectories but not directly in `/app/apps/api`.

**Fix:** use absolute `COPY --chown=nonroot:nonroot ... /app/apps/api` destinations (so the directory itself is created by that `COPY`, already nonroot-owned) and move `WORKDIR` to _after_ the copies.

### 2.3 Live verification

Built the image, ran it attached to the real `docker_amdox-network` (live Postgres + Redis containers, not mocks):

```
GET /health/live → {"status":"ok"}          200
GET /health/db   → {"status":"connected"}   200
docker exec ... node -e "fs.existsSync('/app/apps/api/openapi-spec.json')" → true
docker exec ... node -e "process.getuid()"  → 65532 (nonroot)
```

Final image: 776 MB.

---

## 3. `infra/docker/Dockerfile.web` (Next.js)

**Approach:** added `output: "standalone"` to `apps/web/next.config.ts` (traces the minimal server + node_modules subset Next actually needs), same `turbo prune web --docker` pattern, then copy `.next/standalone` + `.next/static` + `public/` into distroless — no separate `pnpm prune` needed since standalone tracing already does that job.

No runtime bugs here — the one open question (whether the monorepo's directory structure is preserved inside `.next/standalone`, i.e. whether `server.js` lands at `/app/server.js` or `/app/apps/web/server.js`) was verified directly rather than assumed, and the latter was correct on the first build.

`NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_KEYCLOAK_URL` / `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` are build args (Next inlines `NEXT_PUBLIC_*` into the client bundle at build time, not runtime), documented at the top of the Dockerfile with the real `docker build --build-arg ...` invocation.

### Live verification

```
GET /login                                    → real rendered HTML, 200
GET /_next/static/chunks/<hash>.js            → 200
GET /silent-check-sso.html (from public/)     → 200
```

Final image: 287 MB.

---

## 4. `apps/ml-service/Dockerfile` (FastAPI + Prophet + torch/LSTM)

This one was the real risk in the plan — Google's distroless Python images are documented as unsuitable for anything with compiled/native dependencies, and this service has two: **torch** (linked `.so` files) and **Prophet's cmdstan** (a fully separate compiled C++ binary invoked as a subprocess, not just a linked library). Rather than assume distroless wasn't viable and fall back to a plain `python:3.11-slim` runtime, this was tested directly.

### 4.1 Bug found: `python -m venv`'s own `python` binary is a dangling symlink across stages

First attempt copied `/opt/venv` wholesale from the builder and ran `/opt/venv/bin/python`. `venv`'s `bin/python` is a symlink back to the _builder image's_ interpreter path, which doesn't exist in the distroless stage → `exec: "/opt/venv/bin/python": stat ...: no such file or directory`.

**Fix:** don't copy `venv/bin/` at all. Copy only `venv/lib/python3.11/site-packages`, and run the **distroless base's own** `/usr/bin/python3` against it via `PYTHONPATH` — same Python minor version, no symlink to break.

### 4.2 Bug found: `python:3.11-slim` and `distroless/python3-debian12` are no longer the same Debian release

Second attempt failed on `import torch`:

```
ImportError: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found (required by /usr/lib/x86_64-linux-gnu/libstdc++.so.6)
```

Checked directly rather than guessed:

```
python:3.11-slim            → Debian GLIBC 2.41-12 (Debian 13 / trixie — the `slim` tag has moved on)
distroless/python3-debian12 → glibc 2.36            (Debian 12 / bookworm, as the tag name says)
```

`libstdc++.so.6` copied from the (now-trixie) builder needs a newer glibc than distroless's Debian 12 base actually has — a genuine cross-release ABI break, not a distroless limitation per se.

**Fix:** pin the builder to `python:3.11-slim-bookworm` explicitly instead of the floating `python:3.11-slim` tag, so both stages are actually Debian 12.

### 4.3 Live verification — both native code paths, not just imports

Import succeeding isn't proof torch/cmdstan actually run under distroless — both are exercised through their real subprocess/native paths:

```
POST /train  (120 pts, high volume  → LSTM/torch branch)
  → {"model":"lstm","mape":0.0343, ...}   200

POST /train  (40 pts, low volume    → Prophet/cmdstan branch — a separate
                                        compiled binary run as a subprocess,
                                        not just a linked .so)
  → {"model":"prophet","mape":0.1017, ...}   200

docker exec ... python3 -c "os.makedirs('/app/model_registry/...'); open(...,'w')"
  → write ok: True, uid/gid 65532 65532
```

Both real training runs completed and returned predictions — the shared-library and subprocess fixes above hold under actual model training, not just module import.

Final image: 1.69 GB (dominated by torch + prophet + pandas; expected for this dependency set regardless of base image).

### 4.4 Follow-on fix: `docker-compose.yml`'s healthcheck used `curl`

The dev compose file's `ml-service` healthcheck (`CMD curl -f http://localhost:8091/health`) would break the moment this Dockerfile rebuilds, since distroless has no shell or `curl`. Fixed to shell out to the image's own `python3` with `urllib.request` instead — the only exec'able option available in a distroless container. Not yet re-deployed into the live running `amdox-ml-service` container (that container is a shared dev resource and was left untouched — the new image was validated standalone on a separate container/port instead).

---

## 5. Cleanup

- Deleted `infra/docker/Dockerfile.ml` — a dead, empty duplicate. The real ML Dockerfile has always lived at `apps/ml-service/Dockerfile` (that's what `docker-compose.yml`'s `build.context` actually points at), so there was never a reason for two.

## 6. What's still open (Day 22) — both items below are now done

- ~~`docker-compose.prod.yml` — file exists but is empty. Needs all 3 services wired up against the images built here, plus health checks and resource limits.~~ **Done** — the file is now 343 lines, defining `api-db`, `api-db-replica`, `redis`, `api`, `web`, and `ml-service`, each with `healthcheck` and `deploy.resources.limits`.
- ~~Trivy image scanning in CI — needs real images to scan, which now exist; not yet wired into `.github/workflows/ci.yml`.~~ **Done** — `.github/workflows/ci.yml` has an `image-scan` job, a matrix over `api`/`web`/`ml-service` that builds each image and scans it with `aquasecurity/trivy-action`, failing on fixable CRITICAL/HIGH findings.
- `.dockerignore` — already done pre-existing (root `.dockerignore`, excludes `node_modules/`, `.next/`, `dist/`, `.turbo/`).
