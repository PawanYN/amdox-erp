# AmdoxLogger — Branded Terminal Logger

**File:** `apps/api/src/infrastructure/common/logger/amdox-logger.ts`

A lightweight, zero-dependency static logger for the Amdox ERP API. Replaces plain `console.log` and NestJS `Logger` calls with vivid 256-color ANSI output that is instantly scannable by domain and severity.

---

## Log Format

Every line follows this structure:

```
2026-07-04 10:23:41.512  [ FINANCE ]  Journal entry posted  ref=INV-001  id=abc123
```

| Part      | Example                   | Description                                 |
| --------- | ------------------------- | ------------------------------------------- |
| Timestamp | `2026-07-04 10:23:41.512` | Dimmed grey ISO timestamp (ms precision)    |
| Badge     | `[ FINANCE ]`             | Domain/severity label in its assigned color |
| Message   | `Journal entry posted`    | Primary log message                         |
| Extra     | `ref=INV-001  id=abc123`  | Optional key=value context, dimmed          |

---

## Domain Methods

Each business domain has a fixed color so you can spot module logs instantly.

| Method                  | Color           | ANSI # | Use for                                       |
| ----------------------- | --------------- | ------ | --------------------------------------------- |
| `AmdoxLogger.brand()`   | Electric blue   | 39     | Startup, system-level messages                |
| `AmdoxLogger.auth()`    | Violet / indigo | 135    | Token verification, user lookups, role checks |
| `AmdoxLogger.finance()` | Gold            | 220    | GL postings, journal entries, fiscal periods  |
| `AmdoxLogger.hr()`      | Cyan            | 87     | Payroll processing, employees, attendance     |
| `AmdoxLogger.scm()`     | Spring green    | 118    | Purchase orders, goods receipts, inventory    |
| `AmdoxLogger.pm()`      | Peach-orange    | 214    | Projects, budgets, resource allocation        |
| `AmdoxLogger.tenant()`  | Magenta         | 201    | Realm & user provisioning, KC config          |
| `AmdoxLogger.event()`   | Sky blue        | 75     | Cross-module domain events (EventEmitter2)    |

## Severity Methods

Used when the message is not domain-specific or when severity needs to be highlighted.

| Method                   | Color           | When to use                                |
| ------------------------ | --------------- | ------------------------------------------ |
| `AmdoxLogger.info()`     | White           | Generic informational messages             |
| `AmdoxLogger.debug()`    | Grey (dim)      | Verbose / low-level detail                 |
| `AmdoxLogger.warn()`     | Amber           | Recoverable unexpected condition           |
| `AmdoxLogger.error()`    | Crimson         | Failed operation; service continues        |
| `AmdoxLogger.critical()` | White on red bg | Data loss risk or security event           |
| `AmdoxLogger.success()`  | Bright green    | Important operation completed successfully |

## Utility

| Method                        | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `AmdoxLogger.divider(label?)` | Prints a `────` separator line, optionally with a bold label. Used between startup sections. |

---

## Usage

```typescript
import { AmdoxLogger } from '../../common/logger/amdox-logger';

// Domain log — message only
AmdoxLogger.finance('Journal entry posted', 'ref=INV-042  amount=15000');

// Auth flow
AmdoxLogger.auth('Token signature verified', `sub=${payload.sub}`);
AmdoxLogger.success('Authenticated  admin@company.in', 'roles=[TenantAdmin]');

// Event bus
AmdoxLogger.event('payroll.completed → GL entry', `runId=${runId}`);

// Errors
AmdoxLogger.warn('No payslips found — labor cost skipped', `runId=${runId}`);
AmdoxLogger.critical('Payroll GL post FAILED', `err=${error.message}`);

// Startup banner
AmdoxLogger.divider('AMDOX ERP API');
AmdoxLogger.brand('Server ready', 'http://localhost:3001');
AmdoxLogger.divider();
```

### Signature

```typescript
static methodName(msg: string, extra?: string): void
```

- `msg` — primary message; printed in the domain color
- `extra` — optional key=value context string; printed dimmed after the message

---

## Integration Points

The logger is currently active in these files:

| File                                                   | Methods used                                           |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `apps/api/src/main.ts`                                 | `brand`, `divider` — startup banner                    |
| `apps/api/src/auth/strategies/keycloak.strategy.ts`    | `auth`, `debug`, `warn`, `critical`, `success`         |
| `apps/api/src/tenant/tenant.service.ts`                | `tenant`, `hr`, `warn`, `error`, `critical`, `success` |
| `apps/api/src/finance/gl/gl.service.ts`                | `finance`, `event`, `warn`, `error`, `critical`        |
| `apps/api/src/hr/payroll/payroll.processor.ts`         | `hr`, `event`, `success`, `critical`                   |
| `apps/api/src/scm/purchase/purchase.service.ts`        | `scm`, `event`                                         |
| `apps/api/src/finance/pm-cost-bridge.listener.ts`      | `event`                                                |
| `apps/api/src/finance/scm-finance-bridge.listener.ts`  | `event`, `scm`, `critical`                             |
| `apps/api/src/pm/budget/labor-cost-bridge.listener.ts` | `event`, `warn`                                        |

---

## Key Log Points by Flow

### Authentication

```
[  AUTH   ]  Processing token verification…
[  AUTH   ]  Token signature verified            sub=a1b2c3…
[  AUTH   ]  DB lookup for ssoSubject            a1b2c3…
[ SUCCESS ]  Authenticated  admin@company.in     tenant=Company-A  roles=[TenantAdmin]

# Failure paths:
[ CRITICAL]  Invalid token issuer                Expected base: http://localhost:8180
[ CRITICAL]  Blacklisted token used — access denied
[ CRITICAL]  ssoSubject not found in DB          a1b2c3…
```

### Payroll → GL Chain (INT-04 / INT-05)

```
[   HR    ]  Payroll run started: July 2026      runId=abc  tenant=company-a
[ SUCCESS ]  Payroll run complete: July 2026     employees=42  totalNetPay=840000.00
[  EVENT  ]  Emitted payroll.completed           runId=abc

[  EVENT  ]  payroll.completed → GL entry        run=abc  label=July 2026
[ FINANCE ]  Payroll GL entry posted Dr6000/Cr2100  runId=abc  amount=840000

[  EVENT  ]  Labor cost distribution complete    runId=abc  cost.reported×18
```

### Procure-to-Pay Chain (INT-01)

```
[   SCM   ]  PO approved                         poNumber=PO-001  total=50000
[  EVENT  ]  Emitted po.created                  poId=xyz

[  EVENT  ]  goods.received → AP invoice creation  po=PO-001
[   SCM   ]  AP invoice auto-created from GR     po=PO-001  gr=gr-456
[  EVENT  ]  Emitted goods.received → AP invoice + GL chain triggered

[  EVENT  ]  invoice.approved → GL posting       invoiceId=inv-789
[ FINANCE ]  AP invoice posted to GL Dr1300/Cr2000  inv=INV-042  amount=50000
[  EVENT  ]  cost.reported emitted  project=proj-1  source=AP  amount=50000
```

### Tenant Provisioning

```
[ TENANT  ]  Keycloak Admin Client authenticated
[ TENANT  ]  Tenant provisioned: Company A       slug=company-a  id=…
[ TENANT  ]  Admin user created: admin@company-a.in
[ SUCCESS ]  KC realm roles provisioned for tenant: company-a
```

---

## Design Decisions

**Why a static class instead of NestJS `Logger`?**
NestJS `Logger` is instance-based and context-aware, but routes through the Pino logger pipeline which can buffer or format output differently. `AmdoxLogger` calls `console.log` directly with raw ANSI codes so log lines appear immediately with exact colors in any terminal — no Pino config needed.

**Why 256-color instead of basic 16-color?**
Basic colors (red, green, blue) look washed out and are hard to distinguish across 9 domains. 256-color gives precise, vibrant shades per domain. All modern terminals (Windows Terminal, iTerm2, VS Code, WSL) support it.

**Why include `extra` as a second param instead of structured objects?**
Keeps call sites concise (`AmdoxLogger.finance('msg', 'key=value')`) and human-readable in the terminal. Structured JSON logging for production should go through Pino (already configured as the NestJS core logger in `main.ts`).

---

## Extending

To add a new domain (e.g., `notifications`):

1. Add entry to `COLOR` map in `amdox-logger.ts`:
   ```typescript
   notifications: fg(213) + BOLD,  // pink
   ```
2. Add matching entry to `LABELS`:
   ```typescript
   notifications: ' NOTIFY  ',
   ```
3. Add static method to `AmdoxLogger` class:
   ```typescript
   static notifications(msg: string, extra?: string) { print('notifications', msg, extra); }
   ```
