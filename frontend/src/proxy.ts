import { NextResponse, type NextRequest } from "next/server";
import { getNeonAuth } from "@/lib/auth";
import { isPublicAuthPath, LOGIN_URL } from "@/lib/auth-routes";
import { SESSION_VERIFIER_PARAM } from "@/lib/google-auth";

function isLoginRedirect(response: NextResponse) {
  const location = response.headers.get("location");
  if (!location) return false;
  return new URL(location, "http://proxy.invalid").pathname === LOGIN_URL;
}

export async function proxy(request: NextRequest) {
  const auth = getNeonAuth();
  if (!auth) return NextResponse.next();

  const publicPath = isPublicAuthPath(request.nextUrl.pathname);
  const home = request.nextUrl.pathname === "/";
  if (publicPath && !home && !request.nextUrl.searchParams.has(SESSION_VERIFIER_PARAM)) {
    return NextResponse.next();
  }

  const response = await auth.middleware({ loginUrl: LOGIN_URL })(request);
  if (!publicPath || !isLoginRedirect(response)) return response;

  // Public pages still render. Copy any session refresh cookies first so
  // Server Components can read the session without writing cookies themselves.
  const passthrough = NextResponse.next();
  for (const cookie of response.headers.getSetCookie()) {
    passthrough.headers.append("set-cookie", cookie);
  }
  return passthrough;
}

export const config = {
  matcher: [
    "/",
    "/trips",
    "/trips/new",
    "/trips/:path*",
    "/account",
    "/account/:path*",
    "/invite/:path*",
    "/auth/callback",
  ],
};
