import { App, PluginSettingTab, Setting } from "obsidian";
import type GiltmarginPlugin from "./main";

const CURSOR_KEYS_URL = "https://cursor.com/dashboard/integrations";

export class GiltmarginSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: GiltmarginPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const note = containerEl.createDiv({ cls: "giltmargin-settings-note" });
    note.createEl("p", {
      text: "Questions go to a Cursor cloud agent that reads your vault from a GitHub repository. Usage is billed to your Cursor plan.",
    });
    note.createEl("p", {
      text: "The Cursor key stays in this device's local storage, not in the vault. Enter it once on each device.",
    });

    new Setting(containerEl)
      .setName("Cursor API key")
      .setDesc("Create one under Cursor Dashboard → Integrations.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
        text.setPlaceholder("cursor_...");
        text.setValue(this.plugin.getApiKey());
        text.onChange((value) => this.plugin.setApiKey(value.trim()));
      })
      .addButton((button) =>
        button.setButtonText("Open").onClick(() => window.open(CURSOR_KEYS_URL, "_blank")),
      );

    new Setting(containerEl)
      .setName("Vault repository")
      .setDesc("GitHub URL of the repo that holds this vault. Private repos work if Cursor has GitHub access.")
      .addText((text) => {
        text.setPlaceholder("https://github.com/you/your-vault");
        text.setValue(this.plugin.settings.repoUrl);
        text.onChange(async (value) => {
          this.plugin.settings.repoUrl = value.trim().replace(/\.git$/, "");
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Branch")
      .addText((text) => {
        text.setValue(this.plugin.settings.branch);
        text.onChange(async (value) => {
          this.plugin.settings.branch = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Leave empty for your Cursor default. Otherwise a model id such as composer-2.5.")
      .addText((text) => {
        text.setPlaceholder("Cursor default");
        text.setValue(this.plugin.settings.model);
        text.onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Include the open note")
      .setDesc("Send the note you have open with each question, so unsynced edits are seen.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeActiveNote);
        toggle.onChange(async (value) => {
          this.plugin.settings.includeActiveNote = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Note character limit")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.inputMode = "numeric";
        text.setValue(String(this.plugin.settings.noteCharLimit));
        text.onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed) || parsed < 500) return;
          this.plugin.settings.noteCharLimit = Math.min(parsed, 100000);
          await this.plugin.saveSettings();
        });
      });
  }
}
