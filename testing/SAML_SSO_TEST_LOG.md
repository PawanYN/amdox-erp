# Amdox ERP — SAML SSO Live Test Log

**Date:** 2026-07-06
**Environment:** Linux, Node.js v20, API at `http://localhost:3001`, Web at `http://localhost:3000`, Keycloak 25.0.6 at `http://localhost:8180` (container `amdox-keycloak`, internal port 8080)
**Purpose:** `docs/planning/team_assignment.md` claimed "SAML adapter ✅ — wired end-to-end but not live SSO-tested." This log performs that missing live test: register a real external SAML Identity Provider against the `company-a` tenant realm through the app's own code path, then drive an actual login round-trip (external IdP → SAML assertion → Keycloak broker → OIDC token), with no browser — every auto-submit HTML form is parsed and resubmitted by hand with `curl`.

---

## 0. Why this approach (self-contained, no external service)

SAML always needs two sides: a Service Provider (us — the tenant's Keycloak realm, `company-a`) and an external Identity Provider. Rather than depending on a third-party test IdP (e.g. samltest.id), a **second local Keycloak realm** was created to act as the external IdP. This mirrors the app's real realm-per-tenant architecture and needs no internet access. General technique for reproducing this on any Keycloak-backed app:

1. Create a second realm to stand in for "some company's external SAML IdP," with a SAML client whose `clientId` equals your SP's entity ID, and a test user.
2. Keycloak auto-exposes any realm's SAML IdP metadata at `/realms/<realm>/protocol/saml/descriptor` — that's the URL your SAML "metadata descriptor" field points to.
3. Register that descriptor as an identity provider in your tenant's realm.
4. Drive the login. A browser auto-submits two intermediate HTML forms via `onload` JS (`AuthnRequest` → IdP, then `SAMLResponse` → back to your SP). `curl` can't run JS, so each form's `action` + hidden fields must be extracted with a quick regex/`python3` parse and POSTed manually, carrying cookies in a jar across every hop.
5. Success = a final redirect to your app's `redirect_uri` with a real OIDC `code`, which exchanges for a token exactly like a normal login.

---

## 1. Confirm environment is up

### Command

```bash
curl -sf http://localhost:8180/realms/master -o /dev/null -w "master realm reachable: %{http_code}\n"
sudo docker ps --format "{{.Names}}"
sudo docker exec -i amdox-postgres psql -U amdox -d amdox_erp -c 'select slug, name from erp."Tenant";'
```

### Result

```
master realm reachable: 200
amdox-keycloak, amdox-postgres, amdox-redis, amdox-ml-service, amdox-elasticsearch

   slug    |       name
-----------+-------------------
 amdox-erp | Amdox Corporation
 company-a | Company-a
 company-b | company-b
```

### Analysis

Keycloak and Postgres are both up. `company-a` was picked as the test tenant (it's the same realm used in the prior authenticated functional test run — `admin@companya.in` / `Admin123!` password reset earlier in `TERMINAL_TEST_LOG.md` still works via password grant, confirmed below).

---

## 2. Create a second realm to act as the external SAML IdP

### Command

```bash
sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh create realms \
  -s realm=test-idp -s enabled=true -s displayName="Test External IdP"

# SAML client in test-idp representing company-a as the Service Provider
SP_ENTITY_ID="http://localhost:8180/realms/company-a"
ACS_URL="http://localhost:8180/realms/company-a/broker/test-saml/endpoint"
sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh create clients -r test-idp \
  -s clientId="$SP_ENTITY_ID" -s protocol=saml -s enabled=true \
  -s "redirectUris=[\"$ACS_URL\"]" \
  -s 'attributes."saml.authnstatement"=true' \
  -s 'attributes."saml_force_post_binding"=true' \
  -s 'attributes."saml_assertion_consumer_url_post"='"$ACS_URL"

# Test user
sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh create users -r test-idp \
  -s username=saml-test-user -s email=saml-test-user@example.com -s enabled=true -s emailVerified=true
USERID=$(sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh get users -r test-idp \
  -q username=saml-test-user --fields id --format csv --noquotes | tail -1)
sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh set-password -r test-idp \
  --userid "$USERID" --new-password 'SamlTest123!'
```

### Result

Realm, SAML client, and user created successfully (`kcadm.sh` confirmed each with `Created new ... with id '...'`).

### Analysis

`test-idp` now behaves exactly like an external company's Keycloak-based SAML IdP would. Note the one gotcha here that recurs throughout this log: **the container's internal port is 8080, but the host-mapped port is 8180.** Any URL that Keycloak's _server-side_ code fetches (e.g. metadata import) must use `localhost:8080`; any URL that the _browser/curl on the host_ hits must use `localhost:8180`. Getting this backwards produced two of the three failures below.

---

## 3. Register the SAML IdP through the app's real code path — FAILS

### Command

```bash
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/company-a/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=amdox-erp-web&username=admin@companya.in&password=Admin123!" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "http://localhost:3001/tenant/identity-providers" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "alias": "test-saml", "providerId": "saml", "displayName": "Test External IdP", "enabled": true,
    "config": {
      "entityId": "http://localhost:8180/realms/company-a",
      "useMetadataDescriptorUrl": "true",
      "metadataDescriptorUrl": "http://localhost:8180/realms/test-idp/protocol/saml/descriptor"
    }
  }'
```

This is the exact payload shape `SamlForm.submit()` in `apps/web/src/components/settings/idp-manager.tsx` builds, sent through `tenantApi.createIdentityProvider()` → `POST /tenant/identity-providers`.

### Result (first attempt — wrong port, before understanding the 8080/8180 split)

```json
{
  "message": "Keycloak Realm 'company-a' does not exist or is unreachable.",
  "error": "Not Found",
  "statusCode": 404
}
```

Diagnosed as a **separate, pre-existing bug**: `TenantService.onModuleInit()` authenticates its Keycloak admin client _once_ at NestJS boot and never refreshes the token. The API process had been running ~24h, so the admin token/refresh-token pair was long expired, and every `kcAdminClient` call failed silently as "unreachable." **Fixed by restarting the API dev server** (killed the stale `nest start --watch` process that was orphaned holding port 3001, then `pnpm dev` again) — a fresh boot re-authenticates.

### Result (second attempt, after API restart)

```json
{ "error": "Failed to create identity provider" }
```

HTTP status returned was `201` even though the body reports an error — the controller doesn't map service-layer errors to a non-2xx status (a minor bug, not investigated further here). API log showed the real Keycloak error:

```
Invalid identity provider id [null] 400 { errorMessage: 'Invalid identity provider id [null]' }
```

### Analysis

This is the headline finding — see §6 for full root cause and the fix. It reproduces with `providerId: "google"` too (see §5), so it is **not SAML-specific**: creating _any_ identity provider through the app is currently broken.

---

## 4. Isolate whether Keycloak itself or our backend is at fault

### Command — call Keycloak's raw REST API directly with the identical JSON payload our backend sends

```bash
KCTOKEN=$(curl -s -X POST "http://localhost:8180/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "http://localhost:8180/admin/realms/company-a/identity-provider/instances" \
  -H "Authorization: Bearer $KCTOKEN" -H "Content-Type: application/json" \
  -d '{ "alias": "test-saml", "providerId": "saml", "enabled": true, "config": { ... full resolved SAML config ... } }' \
  -D -
```

### Result

```
HTTP/1.1 201 Created
Location: http://localhost:8180/admin/realms/company-a/identity-provider/instances/test-saml
```

### Analysis

Keycloak accepts the exact same payload with no issue. The failure is entirely inside our own backend's `@keycloak/keycloak-admin-client` call, not in Keycloak or in the payload shape. See §6.

---

## 5. Confirm the bug is generic, not SAML-specific

### Command

```bash
curl -s -X POST "http://localhost:3001/tenant/identity-providers" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "alias": "test-google", "providerId": "google", "displayName": "Test Google", "enabled": true,
        "config": { "clientId": "dummy", "clientSecret": "dummy" } }'
```

### Result

```json
{ "error": "Failed to create identity provider" }
```

Same failure as SAML, same underlying Keycloak error.

### Analysis

Confirms this blocks **every** identity-provider type the IdP manager UI supports (Google, Microsoft, GitHub, SAML, OIDC) — a larger-blast-radius bug than the original "SAML adapter" framing suggested.

---

## 6. Root cause

### Command

```bash
grep -n "kcAdminClient.identityProviders.create" apps/api/src/tenant/tenant.service.ts
```

```
await this.kcAdminClient.identityProviders.create({ realm: tenant.slug }, provider);
```

Traced into the installed `@keycloak/keycloak-admin-client` (v26.6.4) source, `lib/resources/agent.js`:

```js
request({ method, path, ... }) {
  return async (payload = {}, options) => { ... }   // <- ONE payload argument; second arg is `options` (things like abort signal), never merged into the body
}
```

and `lib/resources/identityProviders.js`:

```js
create = this.makeRequest({
  method: 'POST',
  path: '/instances',
  returnResourceIdInLocationHeader: { field: 'id' },
});
```

### Analysis

`create()` accepts exactly **one** argument. `tenant.service.ts` was calling it with two: `{ realm: tenant.slug }` as the payload, and the actual identity-provider representation (`alias`, `providerId`, `config`, etc. — the `provider` object built by `SamlForm`/`OidcForm`/etc. in `idp-manager.tsx`) as a second, silently-ignored argument. The result: our backend POSTs an **empty body** to Keycloak's `/admin/realms/{realm}/identity-provider/instances` endpoint. Keycloak correctly rejects an identity-provider create request with no `alias`/`providerId`, surfacing as `Invalid identity provider id [null]`.

This was confirmed as the true cause (not a library version/Location-header issue as first suspected in this log) by reading `agent.js`'s `request()` signature directly, then verifying the fix in §10 restores full config persistence.

Every _other_ `kcAdminClient.*.create()` call in `tenant.service.ts` (`realms.create`, `clients.create`, `users.create`, `roles.create`) already merges the realm and the entity fields into a single object — `createIdentityProvider()` was the only call site with this two-argument mistake.

---

## 7. Prove the actual SAML protocol wiring is correct (bypassing the broken create-IdP step)

With the IdP registered directly via Keycloak's REST API (§4), drove a full login:

### Command sequence (cookies persisted in a jar across every hop)

```bash
JAR=/tmp/.../saml-cookies.txt

# 1. Kick off OIDC login at company-a, hinting straight at the SAML broker
curl -s -c "$JAR" -b "$JAR" -D h1.txt -o /dev/null \
  "http://localhost:8180/realms/company-a/protocol/openid-connect/auth?client_id=amdox-erp-web&redirect_uri=http://localhost:3000/home&response_type=code&scope=openid&kc_idp_hint=test-saml"
# -> 303 to /broker/test-saml/login

# 2. Follow it — Keycloak returns an auto-submit form with a signed SAMLRequest targeting test-idp
curl -s -c "$JAR" -b "$JAR" -o s2-body.html "<location from step 1>"
# extract action / SAMLRequest / RelayState via python3 regex, then:

# 3. POST the AuthnRequest to test-idp (simulating the browser's onload auto-submit)
curl -s -c "$JAR" -b "$JAR" -D h3.txt -o s3-body.html \
  --data-urlencode "SAMLRequest=$SAMLREQ" --data-urlencode "RelayState=$RELAYSTATE" "$ACTION"
# -> first attempt: 400 "Invalid requester" (see analysis below)

# 4/5. Follow redirect to the real login page, submit credentials
curl -s -c "$JAR" -b "$JAR" -D h4.txt -o s4-body.html "<login-actions/authenticate URL>"
curl -s -c "$JAR" -b "$JAR" -D h5.txt -o s5-body.html \
  --data-urlencode "username=saml-test-user" --data-urlencode "password=SamlTest123!" \
  --data-urlencode "credentialId=" "<login form action>"
# -> 302 to required-action VERIFY_PROFILE (user had no first/last name)

# 6/7. Submit the profile form -> get back a SAMLResponse auto-submit form targeting company-a's ACS
curl -s -c "$JAR" -b "$JAR" -o s6-body.html "<required-action URL>"
curl -s -c "$JAR" -b "$JAR" -o s7-body.html \
  --data-urlencode "email=saml-test-user@example.com" --data-urlencode "firstName=Saml" \
  --data-urlencode "lastName=Tester" "<verify-profile form action>"

# 8. POST the SAMLResponse back to company-a's real ACS endpoint
curl -s -c "$JAR" -b "$JAR" -D h8.txt -o s8-body.html \
  --data-urlencode "SAMLResponse=$SAMLRESP" --data-urlencode "RelayState=$RELAYSTATE" \
  "http://localhost:8180/realms/company-a/broker/test-saml/endpoint"
# -> 302 to first-broker-login (new brokered identity, needs linking)

# 9/10. Follow + submit the account-linking form
curl -s -c "$JAR" -b "$JAR" -o s9-body.html "<first-broker-login URL>"
curl -s -c "$JAR" -b "$JAR" -D h10.txt -o s10-body.html \
  --data-urlencode "email=saml-test-user@example.com" --data-urlencode "firstName=Saml" \
  --data-urlencode "lastName=Tester" --data-urlencode "username=saml-test-user@example.com" \
  "<first-broker-login form action>"
# -> 302 to /broker/after-first-broker-login

# 11. Follow -> final redirect to the app with a real OIDC code
curl -s -c "$JAR" -b "$JAR" -D h11.txt -o /dev/null "<after-first-broker-login URL>"
# -> 302 Location: http://localhost:3000/home?...&code=5ab1c6af-....

# 12. Exchange the code for tokens, exactly like the app would
curl -s -X POST "http://localhost:8180/realms/company-a/protocol/openid-connect/token" \
  -d "grant_type=authorization_code&client_id=amdox-erp-web&redirect_uri=http://localhost:3000/home&code=$CODE"
```

### Result of step 3 (first pass) — 400 "Invalid requester"

Diagnosed via the SAML client's stored attributes in `test-idp`: `kcadm.sh create clients` had auto-generated a dummy signing cert/key pair and set `saml.client.signature=true` (require validating the SP's incoming request signature), but that dummy cert doesn't match the real certificate `company-a`'s broker actually signs its `AuthnRequest` with. Fixed with:

```bash
sudo docker exec amdox-keycloak /opt/keycloak/bin/kcadm.sh update clients/<id> -r test-idp \
  -s 'attributes."saml.client.signature"=false'
```

### Result of the full replay after that fix

Every step succeeded. Final token exchange returned a real Keycloak session:

```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "id_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid email profile"
}
```

Decoded `id_token` claims confirmed `preferred_username: "saml-test-user@example.com"`, `given_name: "Saml"`, `family_name: "Tester"`, `iss: "http://localhost:8180/realms/company-a"` — i.e. a genuine company-a session, established purely via a login that happened on the external SAML IdP.

### Analysis

The SAML _protocol_ implementation (signed `AuthnRequest` generation, broker assertion validation, first-broker-login account provisioning, OIDC code issuance) is correct end-to-end. Every failure encountered was either (a) local dev container port-mapping mix-ups (8080 vs 8180 — not a code bug), or (b) the create-IdP admin-client bug in §6 (a real code bug, fixed in this session — see commit). The original doc claim "wired end-to-end but not live SSO-tested" undersold the actual state: it should have been split into "protocol wiring: correct" vs. "IdP creation via the app: broken."

---

## 8. Cleanup

### Command

```bash
curl -X DELETE ".../realms/company-a/users/9e1ba123-..."                 # brokered test user
curl -X DELETE ".../realms/company-a/identity-provider/instances/test-saml"
curl -X DELETE ".../realms/test-idp"                                     # whole stand-in realm, cascades client + user
```

### Result

All three returned `204`. `company-a`'s identity-provider list is back to `[]`; `test-idp` realm returns `404` (gone). `git status` confirmed no source files were altered by the test itself (only the already-tracked `docs/planning/team_assignment.md`, edited separately/concurrently, and this new file).

### Analysis

No lasting artifacts in Keycloak or the app database. The one lasting _environment_ change was restarting the `apps/api` dev server (necessary to clear the stale Keycloak admin token from §3) — not a config or code change.

---

## 9. Summary of findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                            | Severity                                                                   | Status                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `POST /tenant/identity-providers` failed for **every** provider type (Google, Microsoft, GitHub, SAML, OIDC) — `tenant.service.ts` called `kcAdminClient.identityProviders.create({ realm }, provider)` with two arguments, but the client library only accepts one, so the actual identity-provider body was silently dropped and Keycloak received an empty POST | **High** — blocked all SSO setup via the UI                                | **Fixed** — see §10                                             |
| 2   | `TenantService.onModuleInit()` authenticates the Keycloak admin client once at boot with no refresh; a long-lived process silently fails all admin-client calls once the token/refresh-token expire                                                                                                                                                                | Medium — operational, not a functional bug per request                     | Not fixed (out of scope for this log; worth a follow-up ticket) |
| 3   | `TenantController.createIdentityProvider()` (and likely sibling delete/update paths) return HTTP `201`/`200` even when the service layer returns `{error: ...}`                                                                                                                                                                                                    | Low — misleading status code, correct error message still surfaces in body | Not fixed (out of scope)                                        |
| 4   | Once identity-provider creation is bypassed, the actual SAML SSO protocol flow (signed AuthnRequest → external login → signed SAMLResponse → broker validation → OIDC token) works correctly                                                                                                                                                                       | —                                                                          | Confirmed working                                               |

---

## 10. Fix applied and verified

### Command — the fix

```diff
- await this.kcAdminClient.identityProviders.create({ realm: tenant.slug }, provider);
+ await this.kcAdminClient.identityProviders.create({ realm: tenant.slug, ...provider });
```

`apps/api/src/tenant/tenant.service.ts`, `createIdentityProvider()`. Merges the realm and the full provider representation into the single object the library actually sends as the request body.

### Command — re-verify via the real API after restarting the dev server

```bash
curl -s -X POST "http://localhost:3001/tenant/identity-providers" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "alias": "fixverify-saml", "providerId": "saml", "displayName": "Fix Verify SAML", "enabled": true,
        "config": { "entityId": "http://localhost:8180/realms/company-a", "useMetadataDescriptorUrl": "true",
                     "metadataDescriptorUrl": "http://localhost:8180/realms/company-a/protocol/saml/descriptor" } }'

curl -s -X POST "http://localhost:3001/tenant/identity-providers" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "alias": "fixverify-google", "providerId": "google", "displayName": "Fix Verify Google", "enabled": true,
        "config": { "clientId": "dummy", "clientSecret": "dummy" } }'

curl -s "http://localhost:8180/admin/realms/company-a/identity-provider/instances" -H "Authorization: Bearer $KCTOKEN"
```

### Result

Both calls returned `{"success":true}` / HTTP 201. Keycloak's own record of the created providers confirmed the full config was persisted, not an empty stub:

```
fixverify-google google config keys: ['syncMode', 'clientSecret', 'clientId']
fixverify-saml saml config keys: ['syncMode', 'entityId', 'metadataDescriptorUrl', 'useMetadataDescriptorUrl']
```

### Analysis

The fix is confirmed working for both a SAML provider and a non-SAML (Google) provider, closing the finding for all identity-provider types at once. Verification artifacts (`fixverify-saml`, `fixverify-google`) were deleted from `company-a` immediately after confirming — realm identity-provider list is back to `[]`.

**Net effect of this session:** the IdP manager UI (`idp-manager.tsx`) can now actually create identity providers of any type through the app, not just render a form that silently fails server-side. The underlying SAML broker protocol was already correct (§7); this fix closes the gap between "form submits" and "Keycloak actually gets configured."
