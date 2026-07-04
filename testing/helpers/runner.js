/**
 * Amdox ERP — Functional Test Runner
 * AmdoxLogger-style colored ANSI output. No external deps.
 *
 * Usage:
 *   import { suite, test, run } from '../helpers/runner.js';
 *   suite('My Suite', () => {
 *     test('does thing', async () => { ... });
 *   });
 *   await run();
 */

const R     = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const fg    = (n) => `\x1b[38;5;${n}m`;
const bg    = (n) => `\x1b[48;5;${n}m`;

const PASS  = `${fg(46)}${BOLD}[ PASS ]${R}`;
const FAIL  = `${BOLD}${fg(255)}${bg(196)}[ FAIL ]${R}`;
const SKIP  = `${fg(244)}${DIM}[ SKIP ]${R}`;
const INFO  = `${fg(75)}${BOLD}[  --  ]${R}`;
const SUITE = `${fg(220)}${BOLD}`;

function ts() {
  const now = new Date();
  return `${DIM}${fg(245)}${now.toISOString().replace('T', ' ').slice(0, 23)}${R}`;
}

const _suites = [];
let _current  = null;

export function suite(name, fn) {
  const s = { name, tests: [] };
  _suites.push(s);
  const prev = _current;
  _current = s;
  fn();
  _current = prev;
}

export function test(name, fn) {
  if (!_current) throw new Error('test() called outside suite()');
  _current.tests.push({ name, fn });
}

export function skip(name) {
  if (!_current) throw new Error('skip() called outside suite()');
  _current.tests.push({ name, fn: null });
}

export async function run() {
  let totalPass = 0, totalFail = 0, totalSkip = 0;
  const failures = [];

  for (const s of _suites) {
    console.log(`\n${SUITE}━━━ ${s.name} ━━━${R}`);
    for (const t of s.tests) {
      if (!t.fn) {
        console.log(`  ${ts()} ${SKIP}  ${DIM}${t.name}${R}`);
        totalSkip++;
        continue;
      }
      try {
        await t.fn();
        console.log(`  ${ts()} ${PASS}  ${t.name}`);
        totalPass++;
      } catch (err) {
        console.log(`  ${ts()} ${FAIL}  ${t.name}`);
        console.log(`  ${DIM}         ${fg(203)}${err.message}${R}`);
        totalFail++;
        failures.push({ suite: s.name, test: t.name, error: err.message });
      }
    }
  }

  const divider = `${fg(240)}${'─'.repeat(60)}${R}`;
  console.log(`\n${divider}`);
  console.log(
    `  ${fg(46)}${BOLD}${totalPass} passed${R}` +
    (totalFail  ? `  ${BOLD}${fg(196)}${totalFail} failed${R}`  : '') +
    (totalSkip  ? `  ${DIM}${totalSkip} skipped${R}` : '') +
    `  ${DIM}(${_suites.length} suites)${R}`,
  );
  console.log(divider);

  if (failures.length) {
    console.log(`\n${fg(203)}${BOLD}Failed tests:${R}`);
    failures.forEach((f, i) =>
      console.log(`  ${DIM}${i + 1}.${R} ${f.suite} › ${f.test}\n     ${DIM}${f.error}${R}`),
    );
  }

  // Write JSON result for CI / record
  const result = {
    timestamp: new Date().toISOString(),
    pass: totalPass, fail: totalFail, skip: totalSkip,
    failures,
  };

  const { writeFileSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  const dir = join(process.cwd(), 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`\n${DIM}Result saved → ${file}${R}\n`);

  if (totalFail > 0) process.exit(1);
}
