# PLAT-01 — Deploying Amdox ERP to a Public HTTPS URL (Complete Walkthrough)

> **What this document is:** the exact, replayable record of how the live demo
> (`https://erp.92-4-86-3.sslip.io`) was deployed on 11 July 2026 — every command,
> every decision, every dead-end, and the reasoning behind each step. Read it
> top-to-bottom once, then use it as a runbook.
>
> **The result:** production builds of the API + web app running on the existing
> Oracle dev VM, behind Caddy with automatic Let's Encrypt TLS, alongside the
> untouched dev servers — no new server, no domain purchase, ₹0 spent.

---

## 0. The mental model (read this first)

A "deployment" is just answering five questions:

1. **Where does it run?** (a machine with a public IP)
2. **How does traffic reach it?** (DNS name → IP → through firewalls → to a port)
3. **What terminates HTTPS?** (a reverse proxy holding TLS certificates)
4. **What keeps the app processes alive?** (a process manager)
5. **What breaks because the URL changed?** (auth redirects, CORS, hardcoded hosts)

Everything below is one of these five. Question 5 is where all the real debugging
lives — the first four are recipes.

---

## 1. Discovery: is the machine we already have good enough?

Before renting anything, measure what you have. Four commands tell you everything:

```bash
nproc                    # CPU cores            → 6
free -h                  # RAM                  → 47 GB total, 40 GB available
df -h /                  # disk                 → 97 GB, 28 GB free
uname -m                 # architecture         → x86_64
curl -s ifconfig.me      # our OUTBOUND public IP → 92.4.86.3
ss -tlnp | grep -E ":80 |:443 "   # is anything already on the web ports? → empty
```

**Reasoning:** the whole dev Docker stack (Postgres, Redis, Keycloak, MinIO,
Elasticsearch, Mailpit) was using only 5.5 GB of the 47 GB. Adding two Node
processes (~200 MB each) and Caddy (~40 MB) is trivial. Conclusion: this box is
_stronger_ than the free-tier VM we were going to create → deploy here.

**Cloud-specific trick — ask the metadata service who you are.** Every cloud VM
can query a magic link-local address for its own configuration:

```bash
curl -s -H "Authorization: Bearer Oracle" http://169.254.169.254/opc/v2/vnics/
curl -s -H "Authorization: Bearer Oracle" http://169.254.169.254/opc/v2/instance/
```

This told us: private IP `10.0.0.187`, subnet `10.0.0.0/24`, shape
`VM.Standard3.Flex`, region `ap-mumbai-1`. (AWS and GCP have the same idea at the
same IP with different paths.)

---

## 2. Making the ports reachable — the TWO-firewall concept

This is the single most important cloud-networking lesson in this whole document:

> **Cloud VMs sit behind two independent firewalls. BOTH must allow a port,
> or traffic never arrives.**

```
Internet ──▶ [1] Cloud firewall (Oracle "Security List" on the subnet)
                      │
                      ▼
             [2] OS firewall (iptables inside Ubuntu)
                      │
                      ▼
                 your process on the port
```

### 2a. Cloud layer (done in the Oracle web console — the only manual step)

VCN → Security Lists → _the list attached to the instance's subnet_ → Add
Ingress Rules:

| Stateless | Source CIDR | Protocol | Source port | **Destination port** |
| --------- | ----------- | -------- | ----------- | -------------------- |
| off       | `0.0.0.0/0` | TCP      | _(empty)_   | `80`                 |
| off       | `0.0.0.0/0` | TCP      | _(empty)_   | `443`                |

- **Stateless off = stateful**: Oracle remembers each inbound connection and
  automatically allows its reply traffic — no outbound rule needed.
- **Source port stays empty** — that's the visitor's randomly-chosen port.

### 2b. OS layer (Oracle's Ubuntu images ship with restrictive iptables!)

```bash
# See the current rules — note the REJECT at the end and that only 22 is open:
sudo iptables -L INPUT -n --line-numbers

# Insert ACCEPT rules ABOVE the REJECT rule (positions 5 and 6 here):
sudo iptables -I INPUT 5 -p tcp --dport 80  -m state --state NEW -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -m state --state NEW -j ACCEPT

# Persist across reboots (Debian/Ubuntu):
sudo sh -c 'iptables-save > /etc/iptables/rules.v4'
sudo apt-get install -y iptables-persistent   # loads that file at boot
```

**Why `-I INPUT 5` and not `-A INPUT`?** iptables evaluates rules top-down and
stops at the first match. `-A` appends _after_ the final `REJECT all` rule, so
the packet would be rejected before ever reaching your ACCEPT. Position matters.

### 2c. Verifying from OUTSIDE (you cannot test inbound from the box itself)

`curl localhost:80` proves nothing about the internet path. Use a third-party
checker with an API:

```bash
# Start a throwaway listener so there's something to hit:
sudo python3 -m http.server 80 &

# Ask check-host.net to probe from multiple countries:
RID=$(curl -s -H "Accept: application/json" \
  "https://check-host.net/check-tcp?host=92.4.86.3:80&max_nodes=3" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['request_id'])")
sleep 6
curl -s -H "Accept: application/json" "https://check-host.net/check-result/$RID"
```

- `"time": 0.12` → port open. `"error": "Connection timed out"` → a firewall is
  silently **dropping** packets (almost always the cloud layer).
  `"connection refused"` → firewalls fine, nothing listening (an OS-level reply).
  **Timed-out vs refused tells you WHICH layer is broken** — memorise this.

### 2d. The debugging story that actually happened (worth studying)

First check: port 80 **timed out** from every country — but SSH (22) worked
fine. Two facts that seem contradictory. The diagnosis chain:

```bash
# Is 22 truly reachable publicly? Yes (check-host connected in 22 ms).
# Is 92.4.86.3 really THIS machine, or a bastion in front of it?
ssh-keyscan -t ed25519 92.4.86.3 | awk '{print $3}'
awk '{print $2}' /etc/ssh/ssh_host_ed25519_key.pub
# → identical keys ⇒ that IP terminates SSH on THIS box. It IS us.
```

So the IP was right and port 22's rule worked — meaning the new 80/443 rules
had been added to **a different security list than the one attached to our
subnet** (a VCN can hold several lists; only the subnet's list counts). The
fix was navigational, not technical: _instance page → click the Subnet link →
its Security Lists section → the list that already contains the port-22 rule
is the right one → add 80/443 there._ Second check: open worldwide.

---

## 3. A free domain with zero registration: sslip.io

TLS certificates require a **hostname** (Let's Encrypt won't issue for bare
IPs). Buying a domain takes time and money. `sslip.io` is a public DNS service
with one rule: _any name containing an IP resolves to that IP_:

```
erp.92-4-86-3.sslip.io  → 92.4.86.3     (dashes instead of dots)
kc.92-4-86-3.sslip.io   → 92.4.86.3     (unlimited free subdomains!)
```

No account, no payment, nothing to configure. The moment you know your IP, your
domains already exist. (`nip.io` is an identical alternative.)

---

## 4. Architecture decision: prod BESIDE dev, not instead of it

The machine is also the daily dev box, so production must not collide with it:

```
                                    ┌── this box ─────────────────────────────┐
Internet ──HTTPS──▶ Caddy :80/:443 ─┤                                          │
   erp.…sslip.io  /api/*  ─────────▶│ pm2: API prod  :3101 ─┐                  │
   erp.…sslip.io  (rest)  ─────────▶│ pm2: web prod  :3100  │ shared Docker    │
   kc.…sslip.io           ─────────▶│ Keycloak (docker) :8180◀─ infra: Postgres│
                                    │                        │ Redis MinIO ES  │
                                    │ dev: next dev :3000, nest dev :3001 ─────┘
                                    └──────────────────────────────────────────┘
```

- **Same database** as dev — deliberate: the seeded demo data (tenant
  `company-a`, 21 employees, invoices, POs) _is_ what we want to demo.
- Prod processes get their own ports (3100/3101) so `pnpm dev` keeps working.

---

## 5. Code changes the deployment forced (question 5 from the mental model)

### 5a. Hunt for hardcoded URLs — there is always at least one

```bash
grep -rn "localhost" apps/web/src/lib | grep -v test
```

Found: `apps/web/src/lib/keycloak.ts` had `url: "http://localhost:8180"`
**hardcoded**. Fixed to:

```ts
url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180",
```

### 5b. Understand WHEN env vars are read — build-time vs run-time

- **Next.js `NEXT_PUBLIC_*` variables are inlined into the JavaScript at
  `next build` time.** Changing them later does nothing — you must rebuild.
- NestJS reads `process.env` at **run-time** — restart with new env is enough.

So the web app needs a production env file _before_ building:

```bash
# apps/web/.env.production.local   (*.local files are gitignored)
NEXT_PUBLIC_API_URL=https://erp.92-4-86-3.sslip.io/api/v1
NEXT_PUBLIC_KEYCLOAK_URL=https://kc.92-4-86-3.sslip.io

cd apps/web && npx next build     # inlines the values above
cd ../api && npx nest build       # plain compile; env comes later at runtime
```

(`next dev` reads `.env.development*`, so dev stays on localhost automatically.)

---

## 6. Caddy — reverse proxy with automatic free HTTPS

**Why Caddy over nginx:** nginx needs certbot, renewal cron jobs, and ~40 lines
of TLS config. Caddy sees a hostname in its config and silently obtains + renews
Let's Encrypt certificates itself. The entire production proxy is:

```bash
# Install (Ubuntu — Caddy isn't in the default repos):
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
erp.92-4-86-3.sslip.io {
	encode gzip
	handle /api/* {
		reverse_proxy 127.0.0.1:3101 {
			flush_interval -1        # ← critical for SSE (live notifications)
		}
	}
	handle /health* {
		reverse_proxy 127.0.0.1:3101   # health routes are OUTSIDE the api/v1 prefix
	}
	handle /graphql* {
		reverse_proxy 127.0.0.1:3101
	}
	handle /api-docs* {
		reverse_proxy 127.0.0.1:3101   # Swagger
	}
	handle /admin/queues* {
		reverse_proxy 127.0.0.1:3101   # Bull Board
	}
	handle {
		reverse_proxy 127.0.0.1:3100   # everything else → Next.js
	}
}

kc.92-4-86-3.sslip.io {
	reverse_proxy 127.0.0.1:8180       # Keycloak container
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Things to know:

- **ACME needs port 80 reachable from the internet** — that's how Let's Encrypt
  proves you control the name. If Section 2 isn't done, no certificates.
- **`flush_interval -1`** disables response buffering — without it, Server-Sent
  Events (the live notification stream) sit in the proxy's buffer and arrive in
  useless bursts.
- The `/health*`, `/graphql`, `/api-docs`, `/admin/queues` routes exist because
  `main.ts` _excludes_ them from the `api/v1` global prefix — we found this when
  the public health check 404'd. Lesson: **map your app's real route table, not
  the one you assume.**

---

## 7. pm2 — keeping the production processes alive

```bash
sudo npm install -g pm2
```

`infra/pm2/ecosystem.config.js` (committed to the repo):

```js
module.exports = {
  apps: [
    {
      name: 'amdox-api',
      cwd: '/home/ubuntu/amdox-erp/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3101',
        FRONTEND_URL: 'https://erp.92-4-86-3.sslip.io', // CORS allowlist
        KEYCLOAK_BASE_URL: 'https://kc.92-4-86-3.sslip.io', // token issuer check
      },
    },
    {
      name: 'amdox-web',
      cwd: '/home/ubuntu/amdox-erp/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

```bash
pm2 start infra/pm2/ecosystem.config.js
pm2 status                      # both "online"
pm2 logs amdox-api --lines 50   # read boot logs — ALWAYS check after starting
pm2 save                        # snapshot the process list
pm2 startup systemd             # print the command that enables boot-resurrect…
sudo systemctl enable pm2-ubuntu  # …and run it
```

Note how the API's `FRONTEND_URL` and `KEYCLOAK_BASE_URL` are exactly the two
run-time env vars from Section 5b — CORS and the auth issuer are the classic
"URL changed" breakages.

---

## 8. Keycloak behind a proxy — three separate fixes

Auth is where deployments die. Three distinct problems, three fixes:

### 8a. Keycloak was generating `http://` URLs behind an HTTPS proxy

Symptom: `curl -I https://kc.92-4-86-3.sslip.io/` → redirect to
`http://kc.…/admin/` (wrong scheme). Keycloak doesn't trust the proxy's
`X-Forwarded-Proto: https` header until told to:

```yaml
# infra/docker/docker-compose.yml → keycloak.environment:
KC_PROXY_HEADERS: xforwarded
```

```bash
docker compose up -d keycloak   # recreate — realm data lives in Postgres, so it survives
```

After this, tokens carry `"iss": "https://kc.92-4-86-3.sslip.io/realms/company-a"`.

### 8b. The OAuth client must allow the new redirect URL

Keycloak refuses to send users back to any URL not on the client's allowlist
("Invalid redirect_uri" error). Fixed with Keycloak's admin CLI inside the
container:

```bash
# Log the CLI in:
docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

# Find the client's internal id:
docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh get clients -r company-a \
  -q clientId=amdox-erp-web --fields id --format csv --noquotes

# Add the public URL to its redirect list:
docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh update clients/<ID> -r company-a \
  -s 'redirectUris=["http://localhost:3000/*","https://erp.92-4-86-3.sslip.io/*"]'
```

### 8c. Hairpin NAT — the server cannot reach its own public IP

The API validates tokens by downloading Keycloak's public keys (JWKS) from the
issuer URL — which is now `https://kc.92-4-86-3.sslip.io`. But on most clouds a
VM **cannot connect to its own public IP** (the NAT doesn't loop traffic back).
The fix is one line in `/etc/hosts`:

```bash
echo "127.0.0.1 kc.92-4-86-3.sslip.io erp.92-4-86-3.sslip.io" | sudo tee -a /etc/hosts
```

Now when the API resolves `kc.92-4-86-3.sslip.io` it gets `127.0.0.1`, hits the
local Caddy, which serves the **real Let's Encrypt certificate** for that name —
so even certificate validation passes. Browsers outside still resolve via
sslip.io to the public IP. Same name, two paths, both valid.

---

## 9. Incidental fix: Redis eviction policy

The API logged on every boot: `IMPORTANT! Eviction policy is allkeys-lru. It
should be "noeviction"`. Under `allkeys-lru`, Redis silently deletes "least
recently used" keys under memory pressure — **including BullMQ's queued payroll
and notification jobs**. One word in the compose file:

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy noeviction --appendonly yes
```

```bash
docker compose up -d redis
docker exec amdox-redis redis-cli config get maxmemory-policy   # → noeviction
```

---

## 10. Verification — prove the whole chain, not just the homepage

A 200 on the homepage proves almost nothing. The chain that matters is
_login → token → API accepts token → data returns_, all over the public URLs:

```bash
# 1. Get a real token from the PUBLIC Keycloak (password grant):
TOKEN=$(curl -s -X POST \
  "https://kc.92-4-86-3.sslip.io/realms/company-a/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=amdox-erp-web&username=admin@companya.in&password=Admin123!" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Decode its middle segment — confirm the issuer is the public https URL:
echo "$TOKEN" | cut -d. -f2 | base64 -d | python3 -m json.tool | grep iss

# 3. Call the API through the public domain with it:
curl -H "Authorization: Bearer $TOKEN" https://erp.92-4-86-3.sslip.io/api/v1/auth/me
curl -H "Authorization: Bearer $TOKEN" https://erp.92-4-86-3.sslip.io/api/v1/pm/projects
curl -H "Authorization: Bearer $TOKEN" https://erp.92-4-86-3.sslip.io/api/v1/finance/ap/invoices
```

Result: `/auth/me` returned the TenantAdmin with roles + modules; every module
endpoint returned live data. That single passing chain exercises: DNS → Oracle
firewall → iptables → Caddy TLS → Keycloak proxy headers → OAuth client config →
token issuer validation → hairpin JWKS fetch → CORS-independent API auth.

---

## 11. Reboot-survival checklist

A deployment that dies on reboot isn't a deployment. Four things, four persistors:

| What              | Persisted by                                             |
| ----------------- | -------------------------------------------------------- |
| Caddy             | `systemctl is-enabled caddy` → enabled (package default) |
| API + web (pm2)   | `pm2 save` + `systemctl enable pm2-ubuntu`               |
| Docker containers | `restart: unless-stopped` in compose (already set)       |
| iptables rules    | `iptables-persistent` + `/etc/iptables/rules.v4`         |

---

## 12. Runbook: redeploying after code changes

```bash
# API changed:
cd apps/api && npx nest build && pm2 restart amdox-api

# Web changed (remember: NEXT_PUBLIC_* is baked at build time):
cd apps/web && npx next build && pm2 restart amdox-web

# Watch it come back:
pm2 logs --lines 20
curl -s https://erp.92-4-86-3.sslip.io/health/live
```

---

## 13. Troubleshooting map (symptom → layer → tool)

| Symptom                                | Probable layer          | First command                                  |
| -------------------------------------- | ----------------------- | ---------------------------------------------- |
| External check: **timed out**          | Cloud security list     | re-check the SUBNET's list, not just any list  |
| External check: **connection refused** | Nothing listening / OS  | `ss -tlnp \| grep :80`, `iptables -L INPUT -n` |
| Browser: certificate error             | ACME failed → port 80   | `journalctl -u caddy \| grep -i acme`          |
| 502 from Caddy                         | Backend process down    | `pm2 status`, `pm2 logs`                       |
| Login redirects to `http://`           | Proxy headers           | `KC_PROXY_HEADERS=xforwarded` + recreate       |
| "Invalid redirect_uri" at login        | OAuth client allowlist  | `kcadm.sh get clients … --fields redirectUris` |
| API rejects valid-looking tokens       | Issuer mismatch/hairpin | decode token `iss`; check `/etc/hosts` entry   |
| Live notifications arrive in bursts    | Proxy buffering SSE     | `flush_interval -1` on that reverse_proxy      |
| Frontend calls localhost in production | Build-time env baked in | rebuild web with `.env.production.local`       |

---

## 14. The skills you just learned (checklist for your own future deployments)

- [ ] Sizing a server from `nproc` / `free -h` / `df -h` before renting a new one
- [ ] Cloud metadata service (`169.254.169.254`) to learn a VM's own identity
- [ ] The two-firewall model: cloud security list **AND** OS iptables
- [ ] iptables rule _ordering_ (`-I` before the REJECT, never `-A` after it) + persistence
- [ ] Testing inbound reachability from outside (check-host.net), and reading
      _timed out_ vs _refused_ as "which layer is broken"
- [ ] `ssh-keyscan` host-key comparison to prove which machine an IP really is
- [ ] Free hostnames via sslip.io / nip.io
- [ ] Caddy: automatic HTTPS, `handle` routing, SSE `flush_interval -1`
- [ ] Build-time (`NEXT_PUBLIC_*`) vs run-time env vars — and why each matters
- [ ] pm2: ecosystem file, `save`, `startup` for reboot persistence
- [ ] Keycloak behind a proxy: `KC_PROXY_HEADERS`, kcadm redirect-URI surgery
- [ ] Hairpin NAT and the `/etc/hosts` loopback trick
- [ ] Redis `noeviction` for queue workloads (BullMQ)
- [ ] Verifying with a full auth chain (password grant → decode `iss` → call API),
      not just a homepage 200
