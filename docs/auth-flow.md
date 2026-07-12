# Authentication Flow (based on "Amdox Web.pdf")

Here's the full auth flow as the PDF envisions it, drawn as a tree. Read it top to bottom — every login takes exactly one path down.

```
                        Employee opens the ERP
                                 │
                    ┌────────────┴────────────┐
                    │  Which company (tenant)? │   ← email/slug decides the realm
                    │  e.g. acme → realm "acme"│      (realm-per-tenant)
                    └────────────┬────────────┘
                                 │
                 Keycloak shows THAT company's login page
                                 │
        ┌────────────────────────┼──────────────────────────┐
        │                        │                          │
   PATH A: Password         PATH B: Personal           PATH C: Company SSO
   (what we have today)     Google button              (what the PDF promises)
        │                        │                          │
   types email +            Google confirms          ┌──────┴──────┐
   password                 "this Gmail is           │             │
        │                    really theirs"       Microsoft      Google
        │                        │                (Azure AD)    Workspace
        │                        │                    │             │
        │                        │              speaks SAML     speaks OIDC
        │                        │               or OIDC            │
        │                        │                    └──────┬──────┘
        │                        │                           │
        │                        │            company's system confirms
        │                        │            "yes, this employee works here"
        │                        │                           │
        │                        └─────────────┬─────────────┘
        │                                      │
        │                        ┌─────────────┴─────────────┐
        │                        │ Does an account with this  │
        │                        │ email already exist?       │
        │                        └─────┬───────────────┬─────┘
        │                             YES              NO
        │                              │               │
        │                    LINK to that account   create new
        │                    (⚠ this is the step    account
        │                     that blocked you —    │
        │                     Option 2 fixes it)    │
        │                              │            │
        └──────────────┬───────────────┴────────────┘
                       │
              ┌────────┴────────┐
              │ Is MFA enabled  │      ← per tenant (promised in F-01,
              │ for this tenant?│         not built yet ❌)
              └───┬─────────┬───┘
                 YES        NO ──────────────────┐
                  │                              │
        ┌─────────┴──────────┐                   │
        │ First time doing   │                   │
        │ MFA on this account?│                  │
        └────┬──────────┬────┘                   │
            YES         NO                       │
             │           │                       │
       scan QR code      │                       │
       with phone app    │                       │
       (one-time setup)  │                       │
             │           │                       │
             └─────┬─────┘                       │
                   │                             │
         enter 6-digit code                      │
         from the phone app                      │
                   │                             │
          ┌────────┴────────┐                    │
          │  Code correct?  │                    │
          └───┬─────────┬───┘                    │
             YES        NO → try again /         │
              │              ❌ login denied      │
              └──────────────┬───────────────────┘
                             │
          ✅ LOGGED IN — Keycloak issues tokens
                       │
         ┌─────────────┴─────────────┐
         │ Access token (JWT, RS256) │  short-lived pass card
         │ Refresh token             │  to silently get new pass cards
         └─────────────┬─────────────┘
                       │
        ═══ EVERY API REQUEST after login ═══
                       │
              API Gateway checks:
              1. Is the JWT signature genuine?      ✅ built
              2. Is the token blacklisted           ✅ built
                 (user logged out)?
              3. Which tenant? → inject tenantId    ✅ built
                 (you only ever see YOUR data)
              4. Role check (RBAC guard):           ✅ built
                 SuperAdmin / TenantAdmin /
                 Manager / Viewer — allowed
                 to do this action?
                       │
               request served 🎉
```

The key insight from the tree: **paths A, B, C are just three different ways to prove "who you are." Everything after the merge point is identical** — same account, same MFA check, same tokens, same role checks. That's why one person can have both password _and_ Google login: they're two branches leading into the same trunk.

And the two ❌ gaps we found sit at exact spots in this tree: the **link step** (blocked today, our Option 2 fix) and the **MFA diamond** (promised, not enforced yet).

## How to test the Google Workspace SSO path

Three ways, easiest first:

**1. Fake company IdP with Keycloak itself (free, 15 min) — do this first.**
You don't need real Google Workspace to test the _flow_. Create a second realm in your own Keycloak (e.g. `fake-workspace`) with a test user in it, then in Settings → Identity Providers add it as **"Keycloak OpenID Connect"** to a tenant realm. Log in through it. This exercises the exact same brokering path (redirect → external IdP confirms → account created/linked → back to ERP). If this works, the code is correct.

**2. Real Google (free, tests the actual Google screens).**
Create an OAuth client in Google Cloud Console (any Gmail account works, free), add it via the **Google** IdP form. That's Path B. To make it "Workspace-like," fill the **Hosted Domain** field — then Google only accepts accounts from that company domain. That's really all "Google Workspace SSO via OIDC" is: Google login + domain restriction.

**3. Real Google Workspace (only for a final proof).**
Needs a domain you own + a 14-day free Workspace trial. Set up the ERP as an app in the Workspace admin console, connect via the OIDC/SAML form. Only worth it for a demo video or client pilot — not for development.

**Advice:** test with #1 to verify the flow works, then #2 with hosted-domain set to claim "Google Workspace integration" honestly. Skip #3 unless a real client or the demo requires it.

## MFA — what it is and how to test it

**What MFA is:** normally the guard asks one question: "what's your password?" MFA means he asks a **second** question: "also show me the 6-digit code from your phone." A thief might steal your password, but he doesn't have your phone.

**How the code-on-the-phone works:**

1. **One-time setup:** the system shows a QR code on screen. You scan it with an app like Google Authenticator. Now your phone and the system share a secret.
2. **From then on:** the app shows a fresh 6-digit number every 30 seconds. At login, you type the current number. The system knows the secret, so it can check the number is right.

**How to test it:**

1. Open Keycloak's admin panel → find your test user → add the required action **"Configure OTP"** (_"this person must set up OTP"_).
2. Log in as that user → a QR code appears → scan it with the phone app → type the 6-digit code. Setup done.
3. Log out and log in again → now it asks for the code **every time**. That's MFA working. ✅

**The one tricky part:** there are two doors into the account — the password door and the "company login" door (the fake-workspace test). MFA switched on the wrong way only guards the **password door**. The "Configure OTP" required action guards **both doors**. So the full test is: log in with password → asked for code ✅ → log in through fake workspace → asked for code ✅. If both ask, MFA covers the whole tree.

**Honest note:** the ERP's Settings page switches only make MFA _available_ — they don't _force_ it. Forcing it per tenant (what the PDF promised) isn't built yet; today you test inside Keycloak's own admin panel. Building the "force it per tenant" button into Settings is one of the known gaps.

## What the PDF says about MFA

The PDF mentions MFA in exactly two places:

**1. Requirement F-01 (the main one):**

> "…MFA **enforcement per tenant**" — acceptance criteria: "Login < 2s; **MFA enforced**; tenant isolation verified"

In plain words: each company using the ERP should be able to say _"all my employees must use the phone code"_ — and once switched on, it's **forced**, not optional. The feature is only "done" when MFA actually blocks people who skip it.

**2. Security & Compliance table (section 6):**

> "Identity & Access: **MFA**, RBAC, ABAC, Just-in-time access, session timeout — NIST 800-63 / Zero Trust"

In plain words: MFA is listed as one of the promised security controls, aligned to a known security standard (NIST).

That's all — the PDF never says _how_ to build it (no mention of OTP apps, SMS, or Keycloak settings). It only demands the outcome: **per-tenant, enforced, at login**. The "how" (Keycloak's Configure-OTP required action + a switch in the Settings page) is an implementation choice.

## Can every branch be tested locally?

Yes — every branch of the tree is testable on one machine, with nothing paid:

| Branch                   | How to test it                                                                                 | Needs                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Password login (Path A)  | Already works today                                                                            | Nothing                                                         |
| Personal Google (Path B) | Your Gmail + the Google IdP already added                                                      | Free Google OAuth client                                        |
| Company SSO (Path C)     | The fake-workspace realm trick (option 1 above)                                                | Just local Keycloak                                             |
| **Auto-link (the fix)**  | Create employee in ERP → log in with Google using same email → should go straight in, no block | Same as Path B — the original Gmail conflict _is_ the test case |
| **MFA setup + code**     | Turn on "Configure OTP" for a test user → QR appears → scan → code asked every login           | Free authenticator app on a phone                               |
| MFA wrong code           | Type a wrong 6-digit code → denied                                                             | Nothing                                                         |
| MFA on both doors        | Log in with password → code asked; log in via fake workspace → code asked                      | Both of the above                                               |
| Tokens, blacklist, roles | Already covered by existing tests + logout flow                                                | Nothing                                                         |

Everything runs against the local docker-compose Keycloak — no cloud account, no domain, no Workspace trial. The only physical thing needed is a phone with an authenticator app for the MFA part.
