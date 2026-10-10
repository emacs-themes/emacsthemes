/**
 * The JSON data model as a TypeScript domain type.
 *
 * Declaration-order note: `unknown` is deliberately not part of this union —
 * fetch boundaries accept these payloads via zod schemas, and typed fixture
 * helpers (test doubles, recipe readers) pass parsed JSON without widening it.
 */
type JsonPrimitive = string | number | boolean | null | undefined;

/**
 * Interface form of a JSON object. Exposed so fixture local const annotations
 * keep a concrete index contract without re-deriving the union shape.
 */
export interface JsonBag {
  readonly [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonBag;
