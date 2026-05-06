export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function Ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function Err(error: string): Result<never> {
  return { ok: false, error };
}
