import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedVaultPath, selectRelevantNotes } from "../src/vault-context.ts";

describe("selectRelevantNotes", () => {
  it("selects locally relevant notes without duplicating the open note", () => {
    const selected = selectRelevantNotes(
      "What did I decide about mobile authentication?",
      [
        { path: "Projects/Giltmargin.md", content: "Mobile authentication uses a Cursor key." },
        { path: "Daily/2026-10-01.md", content: "Bought groceries and called home." },
        { path: "Open.md", content: "Mobile authentication notes." },
      ],
      { activePath: "Open.md", maxNotes: 3, maxTotalChars: 10_000 },
    );

    assert.deepEqual(selected.map((note) => note.path), ["Projects/Giltmargin.md"]);
  });
});

describe("isAllowedVaultPath", () => {
  it("blocks Obsidian configuration and user-excluded folders", () => {
    assert.equal(isAllowedVaultPath(".obsidian/plugins/example/data.md", []), false);
    assert.equal(isAllowedVaultPath("Private/Health.md", ["Private", "People/Secret"]), false);
    assert.equal(isAllowedVaultPath("Privateer/Notes.md", ["Private"]), true);
    assert.equal(isAllowedVaultPath("Projects/Giltmargin.md", ["Private"]), true);
  });
});
