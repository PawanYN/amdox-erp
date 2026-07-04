/**
 * Amdox ERP — Functional Test Assertion Helpers
 * Lightweight assertions that throw descriptive errors on failure.
 */

export function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label ?? 'assertEquals'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertStatus(res, expected, label) {
  if (res.status !== expected) {
    const body = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data;
    throw new Error(
      `${label ?? 'assertStatus'}: expected HTTP ${expected}, got ${res.status}.\n  Body: ${body}`,
    );
  }
}

export function assertOk(res, label) {
  if (!res.ok) {
    const body = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data;
    throw new Error(`${label ?? 'assertOk'}: expected 2xx, got ${res.status}.\n  Body: ${body}`);
  }
}

export function assertHasKey(obj, key, label) {
  if (!obj || !(key in obj)) {
    throw new Error(`${label ?? 'assertHasKey'}: key "${key}" missing in ${JSON.stringify(obj)}`);
  }
}

export function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label ?? 'assertArray'}: expected Array, got ${typeof value}`);
  }
}

export function assertTruthy(value, label) {
  if (!value) {
    throw new Error(`${label ?? 'assertTruthy'}: expected truthy, got ${JSON.stringify(value)}`);
  }
}

export function assertMatch(value, regex, label) {
  if (!regex.test(String(value))) {
    throw new Error(`${label ?? 'assertMatch'}: "${value}" does not match ${regex}`);
  }
}
