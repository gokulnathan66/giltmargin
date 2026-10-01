import {
  ItemView,
  MarkdownRenderer,
  Notice,
  Platform,
  TFile,
  WorkspaceLeaf,
  requestUrl,
} from "obsidian";
import { CursorAgents, buildPrompt, waitForRun, type Http, type RunState } from "./cursor";
import type GiltmarginPlugin from "./main";
import {
  isAllowedVaultPath,
  selectRelevantNotes,
  type VaultNote,
} from "./vault-context";

export const VIEW_TYPE_GILTMARGIN = "giltmargin-chat";
const CHAT_KEY = "giltmargin.chat.v1";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface StoredChat {
  agentId?: string;
  turns: ChatTurn[];
}

const STATUS_TEXT: Record<string, string> = {
  SEARCHING: "Searching notes on this device…",
  CREATING: "Starting a Cursor agent… the first answer can take a minute.",
  RUNNING: "Writing an answer from the supplied notes…",
};

export const obsidianHttp: Http = async (req) => {
  const res = await requestUrl({
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    throw: false,
  });
  let json: unknown = null;
  try {
    json = res.json;
  } catch {
    json = null;
  }
  return { status: res.status, json };
};

export class GiltmarginView extends ItemView {
  private turns: ChatTurn[] = [];
  private agentId: string | undefined;
  private activeRun: RunState | null = null;
  private statusText = "";
  private banner = "";
  private generation = 0;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private noteCache = new Map<string, { mtime: number; content: string }>();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: GiltmarginPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_GILTMARGIN;
  }

  getDisplayText(): string {
    return "Giltmargin";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    const stored = this.loadChat();
    this.turns = stored.turns;
    this.agentId = stored.agentId;
    this.renderShell();
    const pending = this.plugin.consumePendingPrompt();
    if (pending) this.setDraft(pending);
    await this.paint();
  }

  async onClose(): Promise<void> {
    this.generation += 1;
    this.contentEl.empty();
  }

  setDraft(text: string): void {
    if (!this.inputEl) return;
    this.inputEl.value = text;
    this.inputEl.focus();
  }

  private renderShell(): void {
    this.contentEl.empty();
    this.contentEl.addClass("giltmargin-view");
    const root = this.contentEl.createDiv({ cls: "giltmargin-root" });

    const header = root.createDiv({ cls: "giltmargin-header" });
    const title = header.createDiv({ cls: "giltmargin-title" });
    title.createDiv({ cls: "giltmargin-mark" });
    const heading = title.createDiv();
    heading.createDiv({ cls: "giltmargin-name", text: "Giltmargin" });
    heading.createDiv({ cls: "giltmargin-model", text: "Cursor agent · your vault" });

    const actions = header.createDiv({ cls: "giltmargin-header-actions" });
    this.stopButton = actions.createEl("button", { text: "Stop", cls: "giltmargin-text-button" });
    this.stopButton.hide();
    this.stopButton.addEventListener("click", () => void this.stop());
    const fresh = actions.createEl("button", { text: "New", cls: "giltmargin-text-button" });
    fresh.addEventListener("click", () => {
      void this.stop();
      this.turns = [];
      this.agentId = undefined;
      this.banner = "";
      this.saveChat();
      void this.paint();
    });

    this.messagesEl = root.createDiv({ cls: "giltmargin-messages" });

    const composer = root.createDiv({ cls: "giltmargin-composer" });
    this.inputEl = composer.createEl("textarea", {
      cls: "giltmargin-input",
      attr: { rows: "2", placeholder: "Ask about your notes…" },
    });
    this.inputEl.addEventListener("keydown", (event) => {
      if (Platform.isMobile) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void this.submit();
      }
    });
    this.sendButton = composer.createEl("button", { text: "Send", cls: "giltmargin-send" });
    this.sendButton.addEventListener("click", () => void this.submit());
  }

  private async submit(): Promise<void> {
    const input = this.inputEl;
    if (!input || this.activeRun) return;
    const question = input.value.trim();
    if (!question) return;

    const apiKey = this.plugin.getApiKey();
    const { model } = this.plugin.settings;
    if (!apiKey) {
      new Notice("Set your Cursor API key in Giltmargin settings.");
      return;
    }

    input.value = "";
    this.banner = "";
    this.turns.push({ role: "user", content: question });
    this.saveChat();
    const generation = ++this.generation;
    const agents = new CursorAgents(obsidianHttp, apiKey);

    try {
      this.setStatus("SEARCHING");
      const prompt = await this.promptFor(question, !this.agentId);
      if (generation !== this.generation) return;
      this.setStatus("CREATING");
      let run: RunState;
      if (this.agentId) {
        try {
          run = await agents.followUp(this.agentId, prompt);
        } catch {
          // Archived or expired agents cannot take follow-ups; start a fresh one.
          run = await agents.createAgent({
            prompt: await this.promptFor(question, true),
            model,
          });
        }
      } else {
        run = await agents.createAgent({ prompt, model });
      }
      this.agentId = run.agentId;
      this.activeRun = run;
      this.saveChat();
      this.setStatus(run.status);

      const done = await waitForRun(agents, run, {
        isCancelled: () => generation !== this.generation,
        onStatus: (status) => {
          if (generation === this.generation) this.setStatus(status);
        },
      });
      if (generation !== this.generation) return;

      if (done.status === "FINISHED" && done.result) {
        this.turns.push({ role: "assistant", content: done.result });
        this.plugin.setLastReply(done.result);
      } else if (done.status === "FINISHED") {
        this.banner = "Cursor finished without a reply.";
      } else {
        this.banner = `Cursor run ended: ${done.status.toLowerCase()}.`;
      }
    } catch (error) {
      if (generation !== this.generation) return;
      const failed = this.turns.pop();
      if (failed) input.value = failed.content;
      this.banner = error instanceof Error ? error.message : "Cursor request failed.";
    } finally {
      if (generation === this.generation) {
        this.activeRun = null;
        this.statusText = "";
        this.saveChat();
        this.setBusy(false);
        await this.paint();
      }
    }
  }

  private async stop(): Promise<void> {
    const run = this.activeRun;
    this.generation += 1;
    this.activeRun = null;
    this.statusText = "";
    this.setBusy(false);
    await this.paint();
    if (!run) return;
    const apiKey = this.plugin.getApiKey();
    if (!apiKey) return;
    try {
      await new CursorAgents(obsidianHttp, apiKey).cancel(run.agentId, run.id);
    } catch {
      // The run may already have finished.
    }
  }

  private async promptFor(question: string, firstTurn: boolean): Promise<string> {
    const excludedFolders = this.excludedFolders();
    const activeFile = this.plugin.settings.includeActiveNote ? this.activeNote() : null;
    const allowedActive =
      activeFile && isAllowedVaultPath(activeFile.path, excludedFolders) ? activeFile : null;

    let noteBody: string | undefined;
    if (allowedActive) {
      const raw = await this.app.vault.cachedRead(allowedActive);
      const limit = this.plugin.settings.noteCharLimit;
      noteBody = raw.length > limit ? `${raw.slice(0, limit)}\n\n[clipped]` : raw;
    }

    const relatedNotes = this.plugin.settings.searchVault
      ? selectRelevantNotes(question, await this.readSearchableNotes(excludedFolders), {
          activePath: allowedActive?.path,
          maxNotes: this.plugin.settings.maxRelatedNotes,
          maxTotalChars: this.plugin.settings.relatedNotesCharLimit,
        })
      : [];

    return buildPrompt({
      question,
      firstTurn,
      notePath: allowedActive?.path,
      noteBody,
      relatedNotes,
    });
  }

  private excludedFolders(): string[] {
    return this.plugin.settings.excludedFolders
      .split(/[,\n]/)
      .map((folder) => folder.trim())
      .filter(Boolean);
  }

  private async readSearchableNotes(excludedFolders: string[]): Promise<VaultNote[]> {
    const notes: VaultNote[] = [];
    const livePaths = new Set<string>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!isAllowedVaultPath(file.path, excludedFolders) || file.stat.size > 300_000) continue;
      livePaths.add(file.path);
      let cached = this.noteCache.get(file.path);
      if (!cached || cached.mtime !== file.stat.mtime) {
        cached = { mtime: file.stat.mtime, content: await this.app.vault.cachedRead(file) };
        this.noteCache.set(file.path, cached);
      }
      notes.push({ path: file.path, content: cached.content });
    }
    for (const path of this.noteCache.keys()) {
      if (!livePaths.has(path)) this.noteCache.delete(path);
    }
    return notes;
  }

  private activeNote(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (file && file.extension === "md") return file;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view as { file?: TFile };
      if (view.file instanceof TFile) return view.file;
    }
    return null;
  }

  private setStatus(status: string): void {
    this.statusText = STATUS_TEXT[status] ?? "";
    this.setBusy(true);
    void this.paint();
  }

  private setBusy(busy: boolean): void {
    if (this.sendButton) {
      this.sendButton.disabled = busy;
      this.sendButton.setText(busy ? "…" : "Send");
    }
    if (this.inputEl) this.inputEl.disabled = busy;
    if (this.stopButton) {
      if (busy) this.stopButton.show();
      else this.stopButton.hide();
    }
  }

  private async paint(): Promise<void> {
    const host = this.messagesEl;
    if (!host) return;
    host.empty();
    if (this.banner) host.createDiv({ cls: "giltmargin-banner", text: this.banner });

    if (this.turns.length === 0 && !this.statusText) {
      const empty = host.createDiv({ cls: "giltmargin-empty" });
      empty.createEl("p", { text: "Ask anything about your notes." });
      const ready = this.plugin.getApiKey();
      empty.createEl("p", {
        cls: "giltmargin-empty-sub",
        text: ready
          ? "Notes are selected locally from this vault and sent with your question."
          : "Add your Cursor API key under Settings → Giltmargin.",
      });
      return;
    }

    const sourcePath = this.activeNote()?.path ?? "";
    for (const turn of this.turns) {
      const row = host.createDiv({ cls: `giltmargin-turn giltmargin-${turn.role}` });
      row.createDiv({
        cls: "giltmargin-role",
        text: turn.role === "user" ? "You" : "Cursor",
      });
      const body = row.createDiv({ cls: "giltmargin-body" });
      if (turn.role === "assistant") {
        await MarkdownRenderer.render(this.app, turn.content, body, sourcePath, this);
      } else {
        body.setText(turn.content);
      }
    }
    if (this.statusText) {
      const pending = host.createDiv({ cls: "giltmargin-turn giltmargin-assistant" });
      pending.createDiv({ cls: "giltmargin-role", text: "Cursor" });
      pending.createDiv({ cls: "giltmargin-body giltmargin-pending", text: this.statusText });
    }
    host.scrollTop = host.scrollHeight;
  }

  private loadChat(): StoredChat {
    const stored = this.app.loadLocalStorage(CHAT_KEY);
    if (stored !== null && stored !== undefined) return parseStoredChat(stored);
    const legacy = this.takeLegacyChat();
    if (!legacy) return { turns: [] };
    this.app.saveLocalStorage(CHAT_KEY, legacy);
    return legacy;
  }

  private takeLegacyChat(): StoredChat | null {
    const key = `giltmargin.chat.v1.${this.app.vault.getName()}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      window.localStorage.removeItem(key);
      const parsed = parseStoredChat(raw);
      return parsed.turns.length > 0 || parsed.agentId ? parsed : null;
    } catch {
      return null;
    }
  }

  private saveChat(): void {
    try {
      const payload: StoredChat = { turns: this.turns.slice(-40) };
      if (this.agentId) payload.agentId = this.agentId;
      this.app.saveLocalStorage(CHAT_KEY, payload);
    } catch {
      // A full storage quota should not block the current chat.
    }
  }
}

function parseStoredChat(raw: unknown): StoredChat {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return { turns: [] };
    const record = parsed as { agentId?: unknown; turns?: unknown };
    const turns = Array.isArray(record.turns)
      ? record.turns.filter(
          (turn): turn is ChatTurn =>
            !!turn &&
            typeof turn === "object" &&
            ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
            typeof (turn as ChatTurn).content === "string",
        )
      : [];
    return { agentId: typeof record.agentId === "string" ? record.agentId : undefined, turns };
  } catch {
    return { turns: [] };
  }
}
