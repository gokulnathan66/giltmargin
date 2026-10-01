# Giltmargin

Ask questions about your notes from Obsidian on iPhone, Android, or desktop. Each question goes to a [Cursor cloud agent](https://cursor.com/docs/cloud-agent) that reads your vault from its GitHub repository and replies in a chat panel.

The name is the gilt edge of a book: a thin brass line in the margin of your notes.

## How it works

- Your vault must be in a GitHub repository (private is fine) that your Cursor account can access.
- The first question starts a Cursor agent on that repository. Follow-up questions reuse the same agent, so it keeps the conversation and already-read notes.
- The note you have open is sent along with each question, so edits that are not pushed yet are still seen.
- The agent is told not to edit files, commit, or open pull requests. It only reads and answers.
- Obsidian mobile cannot stream responses, so the panel checks for the answer every few seconds. The first answer usually takes a minute while Cursor starts a machine.

Usage is billed to your Cursor plan. Nothing else is involved: no server of your own and no model provider key.

## Setup

1. Install and enable **Giltmargin**.
2. Create a Cursor API key at [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations).
3. Settings → Giltmargin:
   - **Cursor API key**: paste the key. It is stored in this device's local storage, not in the vault, so sync will not copy it. Enter it once per device.
   - **Vault repository**: for example `https://github.com/you/your-vault`.
   - **Branch**: usually `main`.
   - **Model**: leave empty to use your Cursor default.
4. Run **Giltmargin: Open chat** from the command palette (swipe down on a phone).

## Commands

- **Open chat**
- **Ask about selection**: puts the selected text in the question box
- **Insert last reply at cursor**

On desktop there is also a book icon in the ribbon. **New** starts a fresh agent; **Stop** cancels the running answer.

## Privacy

- Questions, the open note, and the agent's reads of your repository are processed by Cursor.
- The plugin sends requests only to `api.cursor.com`. There is no telemetry.
- The API key never leaves the device except in requests to Cursor.

## Manual install

Copy `main.js`, `manifest.json`, and `styles.css` from the latest release into `YourVault/.obsidian/plugins/giltmargin/`, then enable the plugin under Settings → Community plugins.

## Develop

```bash
npm install
npm test
npm run build
```

`npm run dev` rebuilds `main.js` on change.
