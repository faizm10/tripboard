import type { ModelMessage } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptApiKey, encryptApiKey } from "@/lib/assistant/key-crypto";
import { isKeyAccepted, portableHistory } from "@/lib/assistant/own-key-model";

const secret = "a-test-secret-that-is-long-enough-for-this";

describe("API key encryption", () => {
  it("round trips and never stores the key in the clear", () => {
    const stored = encryptApiKey("sk-my-real-key", "user-1:openai", secret);
    expect(stored).not.toContain("sk-my-real-key");
    expect(decryptApiKey(stored, "user-1:openai", secret)).toBe("sk-my-real-key");
  });

  it("uses a fresh nonce each time", () => {
    expect(encryptApiKey("same", "ctx", secret)).not.toBe(encryptApiKey("same", "ctx", secret));
  });

  it("refuses a value moved to another user or provider", () => {
    const stored = encryptApiKey("sk-my-real-key", "user-1:openai", secret);
    expect(() => decryptApiKey(stored, "user-2:openai", secret)).toThrow();
    expect(() => decryptApiKey(stored, "user-1:google", secret)).toThrow();
  });

  it("refuses a tampered value or the wrong secret", () => {
    const stored = encryptApiKey("sk-my-real-key", "ctx", secret);
    const parts = stored.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptApiKey(parts.join("."), "ctx", secret)).toThrow();
    expect(() => decryptApiKey(stored, "ctx", "another-secret-of-a-reasonable-length")).toThrow();
    expect(() => decryptApiKey("not-a-stored-key", "ctx", secret)).toThrow();
  });
});

describe("key check", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respondWith = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));

  it("rejects a key the provider says is invalid", async () => {
    respondWith(401);
    expect(await isKeyAccepted("openai", "k")).toBe(false);
    respondWith(400);
    expect(await isKeyAccepted("google", "k")).toBe(false);
  });

  it("accepts good keys, restricted keys and provider outages", async () => {
    respondWith(200);
    expect(await isKeyAccepted("anthropic", "k")).toBe(true);
    respondWith(403);
    expect(await isKeyAccepted("openai", "k")).toBe(true);
    respondWith(503);
    expect(await isKeyAccepted("anthropic", "k")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await isKeyAccepted("google", "k")).toBe(true);
  });

  it("sends the key in a header, never the URL", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await isKeyAccepted("google", "secret-key");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("secret-key");
    expect(init.headers).toEqual({ "x-goog-api-key": "secret-key" });
  });
});

describe("portable history", () => {
  const longId = "chatcmpl-tool:0123456789abcdef0123456789abcdef";
  const toolTurn: ModelMessage[] = [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: longId, toolName: "search_places", input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: longId, toolName: "search_places", output: { type: "json", value: {} } }] },
  ];

  it("rewrites tool call ids consistently, in a form every provider accepts", () => {
    const [call, result] = portableHistory([{ role: "user", content: "hi" }, ...toolTurn]).slice(1);
    const callId = (call.content[0] as { toolCallId: string }).toolCallId;
    expect(callId).toMatch(/^[a-zA-Z0-9_-]{1,40}$/);
    expect((result.content[0] as { toolCallId: string }).toolCallId).toBe(callId);
  });

  it("drops another provider's reasoning and any turn left empty", () => {
    const history = portableHistory([
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "reasoning", text: "hmm" }, { type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "reasoning", text: "hmm" }, { type: "text", text: "  " }] },
    ]);
    expect(history).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "text", text: "Hello" }] },
    ]);
  });

  it("opens with a user turn after old messages are trimmed", () => {
    const history = portableHistory([...toolTurn, { role: "assistant", content: "ok" }, { role: "user", content: "next" }]);
    expect(history).toEqual([{ role: "user", content: "next" }]);
  });
});
