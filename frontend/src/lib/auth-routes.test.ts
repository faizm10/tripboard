import { describe, expect, it } from "vitest";
import { isPublicAuthPath } from "@/lib/auth-routes";

describe("isPublicAuthPath", () => {
  it("keeps invite links readable while signed out", () => {
    expect(isPublicAuthPath("/invite/Eaq1rb8BHfgVK6dfGcTsrmRAjtACOCo5ihYqQJnvS5c")).toBe(true);
  });

  it("covers the Google callback and the demo trip", () => {
    expect(isPublicAuthPath("/auth/callback")).toBe(true);
    expect(isPublicAuthPath("/trips/nyc-weekender")).toBe(true);
  });

  it("keeps the marketing homepage public without opening every route", () => {
    expect(isPublicAuthPath("/")).toBe(true);
    expect(isPublicAuthPath("/trips")).toBe(false);
  });

  it("still protects the signed-in app", () => {
    expect(isPublicAuthPath("/trips")).toBe(false);
    expect(isPublicAuthPath("/trips/abc123")).toBe(false);
    expect(isPublicAuthPath("/account")).toBe(false);
  });

  it("does not treat a prefix match as a public route", () => {
    expect(isPublicAuthPath("/invitations")).toBe(false);
    expect(isPublicAuthPath("/trips/nyc-weekender-2")).toBe(false);
  });
});
