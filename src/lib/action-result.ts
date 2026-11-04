/**
 * Server actions return this instead of throwing, because production builds replace thrown
 * messages with a generic React error. `unwrap` turns a failed result back into an Error
 * on the client, so callers keep using try/catch and see the real reason.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function unwrap<T>(result: Promise<ActionResult<T>> | ActionResult<T>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new Error(settled.error);
  return settled.data;
}
