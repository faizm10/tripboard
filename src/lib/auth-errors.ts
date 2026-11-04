export function isReadonlyCookieStoreError(error: unknown) {
  return error instanceof Error && /Cookies can only be modified/i.test(error.message);
}
