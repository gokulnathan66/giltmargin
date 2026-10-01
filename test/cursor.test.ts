import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorAgents, apiError, basicAuth, buildPrompt, waitForRun, type Http } from "../src/cursor.ts";
import { apiKeyStorageKey, readApiKey, writeApiKey } from "../src/secrets.ts";

function recordingHttp(responses: Array<{ status: number; json: unknown }>) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string>; body?: string }> = [];
  const http: Http = async (req) => {
    calls.push(req);
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next;
  };
  return { http, calls };
}

describe("basicAuth", () => {
  it("encodes the key as a username with an empty password", () => {
    assert.equal(basicAuth("cursor_abc"), `Basic ${btoa("cursor_abc:")}`);
  });
});

describe("CursorAgents", () => {
  it("creates a read-only agent on the vault repo", async () => {
    const { http, calls } = recordingHttp([
      { status: 201, json: { agent: { id: "bc-1" }, run: { id: "run-1", agentId: "bc-1", status: "CREATING" } } },
    ]);
    const run = await new CursorAgents(http, "cursor_k").createAgent({
      prompt: "hi",
      repoUrl: "https://github.com/me/vault",
      branch: "main",
      model: "",
    });
    assert.deepEqual(run, { id: "run-1", agentId: "bc-1", status: "CREATING", result: undefined });
    assert.equal(calls[0].url, "https://api.cursor.com/v1/agents");
    const body = JSON.parse(calls[0].body ?? "{}");
    assert.equal(body.autoCreatePR, false);
    assert.equal(body.model, undefined);
    assert.deepEqual(body.repos, [{ url: "https://github.com/me/vault", startingRef: "main" }]);
  });

  it("sends follow-ups to the same agent", async () => {
    const { http, calls } = recordingHttp([
      { status: 201, json: { run: { id: "run-2", agentId: "bc-1", status: "CREATING" } } },
    ]);
    await new CursorAgents(http, "k").followUp("bc-1", "again");
    assert.equal(calls[0].url, "https://api.cursor.com/v1/agents/bc-1/runs");
  });

  it("surfaces API errors", async () => {
    const { http } = recordingHttp([{ status: 401, json: { error: { message: "Invalid API key" } } }]);
    await assert.rejects(() => new CursorAgents(http, "bad").followUp("bc-1", "x"), /Invalid API key/);
  });
});

describe("apiError", () => {
  it("falls back to a readable busy message", () => {
    assert.match(apiError(null, 409).message, /still answering/);
  });
});

describe("waitForRun", () => {
  it("polls until the run finishes", async () => {
    const { http } = recordingHttp([
      { status: 200, json: { id: "run-1", agentId: "bc-1", status: "RUNNING" } },
      { status: 200, json: { id: "run-1", agentId: "bc-1", status: "FINISHED", result: "Answer" } },
    ]);
    const seen: string[] = [];
    const done = await waitForRun(
      new CursorAgents(http, "k"),
      { id: "run-1", agentId: "bc-1", status: "CREATING" },
      { sleep: async () => {}, onStatus: (s) => seen.push(s) },
    );
    assert.equal(done.result, "Answer");
    assert.deepEqual(seen, ["RUNNING", "FINISHED"]);
  });

  it("stops polling when cancelled", async () => {
    const { http, calls } = recordingHttp([]);
    const done = await waitForRun(
      new CursorAgents(http, "k"),
      { id: "run-1", agentId: "bc-1", status: "RUNNING" },
      { sleep: async () => {}, isCancelled: () => true },
    );
    assert.equal(done.status, "RUNNING");
    assert.equal(calls.length, 0);
  });
});

describe("buildPrompt", () => {
  it("adds read-only instructions only on the first turn", () => {
    const first = buildPrompt({ question: "Q?", firstTurn: true, notePath: "a.md", noteBody: "body" });
    assert.match(first, /Do not edit/);
    assert.match(first, /<note path="a.md">\nbody\n<\/note>/);
    const later = buildPrompt({ question: "Q2?", firstTurn: false });
    assert.doesNotMatch(later, /Do not edit/);
    assert.match(later, /Question: Q2\?/);
  });
});

describe("api key storage", () => {
  it("scopes the key per vault and clears it", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    } as unknown as Storage;
    writeApiKey(storage, "vault-1", "cursor_secret");
    assert.equal(readApiKey(storage, "vault-1"), "cursor_secret");
    assert.equal(readApiKey(storage, "vault-2"), "");
    assert.equal(memory.get(apiKeyStorageKey("vault-1")), "cursor_secret");
    writeApiKey(storage, "vault-1", "");
    assert.equal(readApiKey(storage, "vault-1"), "");
  });
});
