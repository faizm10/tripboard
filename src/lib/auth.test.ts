import { describe, expect, it, vi } from "vitest";
import { authFailureMessage, isReadonlyCookieStoreError } from "@/lib/auth-errors";
import { isSignInUnavailable } from "@/lib/auth-status";

describe("session reads in Server Components", () => {
  it("recognizes Next.js blocking cookie writes during render", () => {
    expect(
      isReadonlyCookieStoreError(
        new Error("Cookies can only be modified in a Server Action or Route Handler."),
      ),
    ).toBe(true);
  });

  it("lets real auth failures surface", () => {
    expect(isReadonlyCookieStoreError(new Error("Auth server unreachable"))).toBe(false);
  });
});

describe("sign-in failure messages", () => {
  it("hides the provider's quota text behind a plain unavailable note", () => {
    const quota = { status: 402, code: "GENERIC_QUOTA_EXCEEDED", message: "Your account or project has exceeded the quota. Upgrade your plan to increase limits." };
    expect(authFailureMessage(quota, "Google sign-in could not start.")).toBe("Sign-in is unavailable right now. Try again in a moment.");
    expect(authFailureMessage({ status: 503 }, "fallback")).toBe("Sign-in is unavailable right now. Try again in a moment.");
  });

  it("keeps the auth server's own message for ordinary failures", () => {
    expect(authFailureMessage({ status: 401, message: "Invalid email or password" }, "fallback")).toBe("Invalid email or password");
    expect(authFailureMessage({ status: 503, error: "Sign-in is unavailable right now." }, "fallback")).toBe("Sign-in is unavailable right now. Try again in a moment.");
    expect(authFailureMessage({ status: 400 }, "Google sign-in could not start.")).toBe("Google sign-in could not start.");
  });
});

describe("sign-in outage probe", () => {
  it("flags a quota pause once and serves the answer from cache", async () => {
    const env = { NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET };
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
    process.env.NEON_AUTH_COOKIE_SECRET = "x".repeat(32);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response('{"code":"GENERIC_QUOTA_EXCEEDED"}', { status: 402 }));
    try {
      expect(await isSignInUnavailable()).toBe(true);
      expect(await isSignInUnavailable()).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
      for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
});
