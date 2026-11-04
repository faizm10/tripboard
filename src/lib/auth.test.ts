import { describe, expect, it } from "vitest";
import { isReadonlyCookieStoreError } from "@/lib/auth-errors";

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
