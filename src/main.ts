import { Editor, Notice, Platform, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, type GiltmarginSettings } from "./models";
import { readApiKey, writeApiKey } from "./secrets";
import { GiltmarginSettingTab } from "./settings";
import { GiltmarginView, VIEW_TYPE_GILTMARGIN } from "./view";

export default class GiltmarginPlugin extends Plugin {
  settings: GiltmarginSettings = { ...DEFAULT_SETTINGS };
  private lastReply = "";
  private pendingPrompt: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_GILTMARGIN, (leaf) => new GiltmarginView(leaf, this));
    this.addSettingTab(new GiltmarginSettingTab(this.app, this));

    this.addRibbonIcon("book-open", "Open Giltmargin", () => void this.activateView());

    this.addCommand({
      id: "open-chat",
      name: "Open chat",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "ask-selection",
      name: "Ask about selection",
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection().trim();
        if (!selection) {
          new Notice("Select some text first.");
          return;
        }
        this.pendingPrompt = selection;
        void this.activateView();
      },
    });

    this.addCommand({
      id: "insert-last-reply",
      name: "Insert last reply at cursor",
      editorCallback: (editor: Editor) => {
        if (!this.lastReply) {
          new Notice("Giltmargin has no reply yet.");
          return;
        }
        editor.replaceSelection(this.lastReply);
      },
    });
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_GILTMARGIN);
    const leaf: WorkspaceLeaf =
      existing[0] ?? this.app.workspace.getLeaf(Platform.isMobile ? "tab" : "split");
    await leaf.setViewState({ type: VIEW_TYPE_GILTMARGIN, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const prompt = this.consumePendingPrompt();
    if (prompt && leaf.view instanceof GiltmarginView) leaf.view.setDraft(prompt);
  }

  consumePendingPrompt(): string | null {
    const prompt = this.pendingPrompt;
    this.pendingPrompt = null;
    return prompt;
  }

  setLastReply(text: string): void {
    this.lastReply = text;
  }

  getApiKey(): string {
    try {
      return readApiKey(localStorage, this.app.vault.getName());
    } catch {
      return "";
    }
  }

  setApiKey(apiKey: string): void {
    try {
      writeApiKey(localStorage, this.app.vault.getName(), apiKey);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not store the API key.");
    }
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<GiltmarginSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(): Promise<void> {
    await this.saveData({ ...this.settings });
  }
}
