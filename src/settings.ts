import { App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type GiltmarginPlugin from "./main";

const CURSOR_KEYS_URL = "https://cursor.com/dashboard/integrations";

export class GiltmarginSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: GiltmarginPlugin,
  ) {
    super(app, plugin);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "model" && typeof value === "string") value = value.trim();
    await super.setControlValue(key, value);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Giltmargin",
        desc: "Reads notes locally through Obsidian, then sends selected text to a repository-free Cursor cloud agent. Usage is billed to your Cursor plan. The key stays in Obsidian SecretStorage, not in the vault. Enter it once on each device.",
      },
      {
        name: "Cursor API key",
        desc: "Create one under Cursor Dashboard → Integrations.",
        render: (setting) => {
          setting.addText((text) => {
            text.inputEl.type = "password";
            text.inputEl.autocomplete = "off";
            text.setPlaceholder("cursor_...");
            text.setValue(this.plugin.getApiKey());
            text.onChange((value) => this.plugin.setApiKey(value.trim()));
          });
          setting.addButton((button) =>
            button.setButtonText("Open").onClick(() => window.open(CURSOR_KEYS_URL, "_blank")),
          );
        },
      },
      {
        name: "Model",
        desc: "Leave empty for your Cursor default. Otherwise a model id such as composer-2.5.",
        control: { type: "text", key: "model", placeholder: "Cursor default" },
      },
      {
        name: "Include the open note",
        desc: "Send the note you have open with each question, so unsynced edits are seen.",
        control: { type: "toggle", key: "includeActiveNote" },
      },
      {
        name: "Search the vault",
        desc: "Find related Markdown notes locally and include the best matches with each question.",
        control: { type: "toggle", key: "searchVault" },
      },
      {
        name: "Maximum related notes",
        desc: "Limits data sent and keeps searches responsive on phones.",
        control: {
          type: "number",
          key: "maxRelatedNotes",
          min: 0,
          max: 20,
          validate: (value) => wholeNumber(value, 0, 20),
        },
      },
      {
        name: "Related-notes character limit",
        desc: "Total text across related notes. The open note has its own limit below.",
        control: {
          type: "number",
          key: "relatedNotesCharLimit",
          min: 1000,
          max: 100000,
          validate: (value) => wholeNumber(value, 1000, 100000),
        },
      },
      {
        name: "Excluded folders",
        desc: "Comma-separated vault-relative folders that Giltmargin must never read.",
        control: { type: "textarea", key: "excludedFolders", placeholder: ".trash, Private" },
      },
      {
        name: "Note character limit",
        desc: "Maximum text sent from the open note.",
        control: {
          type: "number",
          key: "noteCharLimit",
          min: 500,
          max: 100000,
          validate: (value) => wholeNumber(value, 500, 100000),
        },
      },
    ];
  }
}

function wholeNumber(value: number, min: number, max: number): string | void {
  if (Number.isInteger(value) && value >= min && value <= max) return;
  return `Use a whole number from ${min} to ${max}.`;
}
