# Giltmargin

Ask questions about notes in your local Obsidian vault from iPhone, Android, or desktop. Giltmargin reads notes through Obsidian on the device, selects relevant context locally, and sends that context to a repository-free [Cursor cloud agent](https://cursor.com/docs/cloud-agent).

The name is the gilt edge of a book: a thin brass line in the margin of your notes.

## How it works

- No GitHub or GitLab repository is needed for your vault.
- The open note is read directly through Obsidian and included with the question.
- Giltmargin searches Markdown notes locally using the words in your question and sends only the highest-ranking matches, within configurable limits.
- The Cursor agent has no repository and no direct access to your vault. It can only see the note text supplied by the plugin.
- Follow-up questions reuse the same agent so conversation context is retained.
- Obsidian mobile cannot stream responses, so the panel checks for the answer every few seconds. The first answer usually takes a minute while Cursor starts a machine.

Usage is billed to your Cursor plan. No server of your own or model-provider key is needed.

## Authentication limitation

Cursor currently requires a user or service-account API key for its Cloud Agents API. It does not provide an OAuth/SSO flow that an Obsidian plugin can use. Giltmargin therefore cannot offer Cursor sign-in yet.

Claude Code also cannot run inside Obsidian mobile, which has no Node.js process runtime. Anthropic does not permit third-party products to reuse Claude subscription OAuth. Giltmargin will adopt an allowed sign-in flow if Cursor or Anthropic publishes one.

## Setup

1. Install and enable **Giltmargin**. Obsidian 1.13.0 or newer is required.
2. Create a Cursor API key at [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations).
3. Settings → Giltmargin:
   - **Cursor API key**: paste the key. It is stored using Obsidian SecretStorage, not in the vault.
   - **Model**: leave empty to use your Cursor default.
   - **Search the vault**: enable local related-note search.
   - **Excluded folders**: add folders whose notes must never be read or sent.
4. Run **Giltmargin: Open chat** from the command palette (swipe down on a phone).

## Commands

- **Open chat**
- **Ask about selection**: puts the selected text in the question box
- **Insert last reply at cursor**

On desktop there is also a book icon in the ribbon. **New** starts a fresh agent; **Stop** cancels the running answer.

## Privacy

- Questions and selected note text are processed by Cursor.
- Vault searching happens locally inside Obsidian.
- `.obsidian`, configured excluded folders, and files over 300 KB are never searched.
- The plugin sends requests only to `api.cursor.com`. There is no telemetry.
- The API key is held by Obsidian SecretStorage and is sent only to Cursor.

## Manual install

Copy `main.js`, `manifest.json`, and `styles.css` from the latest release into `YourVault/.obsidian/plugins/giltmargin/`, then enable the plugin under Settings → Community plugins.

## Develop

```bash
npm install
npm test
npm run build
```

`npm run dev` rebuilds `main.js` on change.
