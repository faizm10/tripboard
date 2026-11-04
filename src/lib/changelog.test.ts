import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

const semver = /^\d+\.\d+\.\d+$/;

function compare(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

describe("changelog", () => {
  it("matches the version in package.json", () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it("lists valid versions newest first, each once", () => {
    for (const entry of CHANGELOG) {
      expect(entry.version).toMatch(semver);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.changes.length).toBeGreaterThan(0);
    }
    for (let index = 1; index < CHANGELOG.length; index += 1) {
      expect(compare(CHANGELOG[index - 1].version, CHANGELOG[index].version)).toBeGreaterThan(0);
    }
  });
});
