export const LOGIN_URL = "/sign-in";

/**
 * Routes anyone may open while signed out. They still run the auth middleware
 * when a Google sign-in returns with `?neon_auth_session_verifier=…`, because
 * the middleware is the only place that trades that token for a session
 * cookie — but they are never bounced to the sign-in page.
 */
const PUBLIC_PATHS = ["/", "/trips/nyc-weekender", "/invite", "/auth/callback"];

export function isPublicAuthPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
