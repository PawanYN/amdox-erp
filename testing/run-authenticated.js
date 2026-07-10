#!/usr/bin/env node
/**
 * Run functional tests with auto Keycloak token (no token printed).
 * Usage: node run-authenticated.js [--suite 01]
 */
import { ensureTestToken } from './fetch-test-token.mjs';

const ok = await ensureTestToken();
if (!ok) {
  console.error('Cannot run authenticated suites without a valid TEST_TOKEN.');
  process.exit(1);
}

// Re-exec run-all with token in env
const args = process.argv.slice(2);
await import('./run-all.js');
