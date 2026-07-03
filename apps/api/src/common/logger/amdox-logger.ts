/**
 * AmdoxLogger — Branded, colorful terminal logger for Amdox ERP API
 *
 * Uses 256-color ANSI escape codes for vivid, easily scannable output.
 * Each domain has its own color palette; severity has its own shape.
 *
 * Usage:
 *   AmdoxLogger.auth('User authenticated', email);
 *   AmdoxLogger.finance('Journal entry posted', ref);
 *   AmdoxLogger.critical('Payroll GL failed', error.message);
 */

// ─── Reset ────────────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ─── 256-color foreground helpers ─────────────────────────────────────────────
const fg = (n: number) => `\x1b[38;5;${n}m`;
const bg = (n: number) => `\x1b[48;5;${n}m`;

// ─── Domain color map ─────────────────────────────────────────────────────────
const COLOR = {
  // Amdox brand — electric blue
  brand:   fg(39)  + BOLD,
  // Auth — violet / indigo
  auth:    fg(135) + BOLD,
  // Finance / GL — gold
  finance: fg(220) + BOLD,
  // HR / Payroll — cyan
  hr:      fg(87)  + BOLD,
  // SCM / Inventory — spring green
  scm:     fg(118) + BOLD,
  // Projects / PM — peach-orange
  pm:      fg(214) + BOLD,
  // Tenant provisioning — magenta
  tenant:  fg(201) + BOLD,
  // Events / bus — sky blue
  event:   fg(75)  + BOLD,
  // Info — white
  info:    fg(255),
  // Debug — grey
  debug:   fg(244) + DIM,
  // Warn — amber
  warn:    fg(214) + BOLD,
  // Error — crimson
  error:   fg(196) + BOLD,
  // Critical — white on red bg
  critical: BOLD + fg(255) + bg(196),
  // Success — bright green
  success: fg(46)  + BOLD,
} as const;

type Domain = keyof typeof COLOR;

// ─── Timestamp ────────────────────────────────────────────────────────────────
function ts(): string {
  const now = new Date();
  return `${DIM}${fg(245)}${now.toISOString().replace('T', ' ').slice(0, 23)}${R}`;
}

// ─── Label badge ─────────────────────────────────────────────────────────────
const LABELS: Record<Domain, string> = {
  brand:    '  AMDOX  ',
  auth:     '  AUTH   ',
  finance:  ' FINANCE ',
  hr:       '   HR    ',
  scm:      '   SCM   ',
  pm:       '   PM    ',
  tenant:   ' TENANT  ',
  event:    '  EVENT  ',
  info:     '  INFO   ',
  debug:    '  DEBUG  ',
  warn:     '  WARN   ',
  error:    '  ERROR  ',
  critical: ' CRITICAL',
  success:  ' SUCCESS ',
};

function badge(domain: Domain): string {
  return `${COLOR[domain]}[${LABELS[domain]}]${R}`;
}

// ─── Core print ──────────────────────────────────────────────────────────────
function print(domain: Domain, msg: string, extra?: string): void {
  const line = extra
    ? `${ts()} ${badge(domain)} ${COLOR[domain]}${msg}${R}  ${DIM}${fg(246)}${extra}${R}`
    : `${ts()} ${badge(domain)} ${COLOR[domain]}${msg}${R}`;
  console.log(line);
}

// ─── Public API ──────────────────────────────────────────────────────────────
export class AmdoxLogger {
  /** Amdox system/startup messages */
  static brand(msg: string, extra?: string)    { print('brand',   msg, extra); }

  /** Auth — token validation, user lookups, role checks */
  static auth(msg: string, extra?: string)     { print('auth',    msg, extra); }

  /** Finance — GL, journal entries, fiscal periods */
  static finance(msg: string, extra?: string)  { print('finance', msg, extra); }

  /** HR — employees, payroll, attendance */
  static hr(msg: string, extra?: string)       { print('hr',      msg, extra); }

  /** SCM — vendors, purchase orders, inventory */
  static scm(msg: string, extra?: string)      { print('scm',     msg, extra); }

  /** Projects / PM — budgets, tasks, resources */
  static pm(msg: string, extra?: string)       { print('pm',      msg, extra); }

  /** Tenant provisioning — realm & user creation */
  static tenant(msg: string, extra?: string)   { print('tenant',  msg, extra); }

  /** Cross-module domain events */
  static event(msg: string, extra?: string)    { print('event',   msg, extra); }

  /** Generic informational */
  static info(msg: string, extra?: string)     { print('info',    msg, extra); }

  /** Debug — verbose, lower-level detail */
  static debug(msg: string, extra?: string)    { print('debug',   msg, extra); }

  /** Warning — recoverable unexpected condition */
  static warn(msg: string, extra?: string)     { print('warn',    msg, extra); }

  /** Error — failed operation, service may continue */
  static error(msg: string, extra?: string)    { print('error',   msg, extra); }

  /** Critical — potential data loss or security concern; highest visibility */
  static critical(msg: string, extra?: string) { print('critical', msg, extra); }

  /** Success — important operation completed successfully */
  static success(msg: string, extra?: string)  { print('success', msg, extra); }

  /** Separator line useful between startup sections */
  static divider(label = '') {
    const line = '─'.repeat(60);
    console.log(`\n${fg(240)}${line}${label ? `  ${BOLD}${fg(255)}${label}${R}` : ''}${R}\n`);
  }
}
