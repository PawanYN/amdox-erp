#!/usr/bin/env node
/**
 * Amdox ERP — Functional Test Master Runner
 *
 * Runs all suites in sequence and prints a combined AmdoxLogger-style report.
 *
 * Usage:
 *   node testing/run-all.js
 *   API_BASE=http://localhost:3001/api/v1 TEST_TOKEN=<jwt> node testing/run-all.js
 *
 * Per-suite:
 *   node testing/run-all.js --suite 01
 *   node testing/run-all.js --suite health
 */

import { run } from './helpers/runner.js';

const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const fg = (n) => `\x1b[38;5;${n}m`;

const BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';
const TOKEN = process.env.TEST_TOKEN;

// ── Banner ────────────────────────────────────────────────────────────────────
console.log(
  `\n${fg(240)}${'─'.repeat(60)}  ${BOLD}${fg(39)}AMDOX ERP${R}${fg(240)}  ${'─'.repeat(10)}${R}`,
);
console.log(`  ${fg(220)}${BOLD}Functional Test Suite${R}   ${DIM}AMX-ERP-2026-04 · Day 14${R}`);
console.log(`  ${DIM}API  : ${BASE}${R}`);
console.log(
  `  ${DIM}Token: ${TOKEN ? `${TOKEN.slice(0, 12)}…` : 'NOT SET — protected tests will be skipped'}${R}`,
);
console.log(`${fg(240)}${'─'.repeat(80)}${R}\n`);

// ── Filter by --suite arg ─────────────────────────────────────────────────────
const suiteArg = (() => {
  const i = process.argv.indexOf('--suite');
  return i !== -1 ? process.argv[i + 1] : null;
})();

const ALL_SUITES = [
  './suites/01-health.test.js',
  './suites/02-finance-gl.test.js',
  './suites/03-hr-payroll.test.js',
  './suites/04-scm.test.js',
  './suites/05-pm.test.js',
  './suites/06-forecast.test.js',
  './suites/07-auth-rbac.test.js',
  './suites/08-smoke-p2p-chain.test.js',
  './suites/09-audit.test.js',
];

const toLoad = suiteArg ? ALL_SUITES.filter((s) => s.includes(suiteArg)) : ALL_SUITES;

if (toLoad.length === 0) {
  console.error(`No suite matching --suite "${suiteArg}"`);
  process.exit(1);
}

// ── Dynamic import of each suite (they register via suite()/test()) ───────────
for (const path of toLoad) {
  await import(path);
}

// ── Execute ───────────────────────────────────────────────────────────────────
await run();
