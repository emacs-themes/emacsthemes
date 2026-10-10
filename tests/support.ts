/**
 * Shared helpers for hand-built test doubles.
 *
 * The suites drive DOM/browser rendering through minimal object substitutes
 * instead of a real DOM. These helpers retype those substitutes once, at the
 * point where the substitute meets a browser-typed contract.
 */

/**
 * Re-types a hand-built test double to the contract it imitates.
 *
 * The target type flows from the assignment context; no annotations are
 * needed at the call site.
 *
 * SAFETY: double substitutes carry only the API surface a suite exercises,
 * and the behavioral assertions verify the substitute itself; no separate
 * schema applies to fixtures.
 */
export function substitute<T, U>(candidate: U): T {
  // SAFETY: the substitute's surface is verified by each suite's behavioral assertions.
  return candidate as T & U;
}

/** Type predicate narrowing warning payloads to readable strings. */
export function isMessageString(value: unknown): value is string {
  return typeof value === "string";
}
