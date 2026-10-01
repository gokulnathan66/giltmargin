# Giltmargin

## Goal

Giltmargin is an Obsidian plugin and nothing else. It runs inside Obsidian on iPhone, Android, and desktop. The user opens a chat in the app and asks about their notes. The plugin reads those notes from the vault on the device and shows the answer in the chat.

## Owner requirements

These are the owner's requirements, in priority order. Keep them as the target even where the status column says they are blocked today.

| # | Requirement | Status (checked 2026-10-01) |
| --- | --- | --- |
| 1 | Use Claude Code in a terminal inside the plugin, signed in with the owner's Claude account (SSO login), the way Claude Code signs in on a computer. | Blocked. See "Claude Code and SSO" below. |
| 2 | No API key or other pasted credential. Sign-in only. | Blocked for both Claude and Cursor today. |
| 3 | No vault repository. Read notes only from the Obsidian vault on the device. | Possible. Required for every design. |
| 4 | Use a Cursor agent if possible, signed in through Cursor SSO instead of an API key. | Cursor agents are possible. SSO without a key is blocked. |

### Claude Code and SSO

- Obsidian on iPhone and Android has no Node.js and cannot start another program, so Claude Code cannot run inside the plugin. A terminal in the plugin can only connect to a machine that runs Claude Code elsewhere.
- Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) allows Claude account (subscription OAuth) login only in Claude Code and Anthropic's own apps. Third-party products may not offer Claude.ai login or send requests with that login. Do not implement a Claude login flow, reuse Claude Code tokens, or imitate Claude Code requests in this plugin.
- Revisit only if Anthropic publishes a sign-in that third-party apps are allowed to use.

### Cursor and SSO

- The [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) accepts only a user API key or a team service account key, sent as Basic or Bearer auth. Cursor has no sign-in flow that a third-party app can use to get a token for that API.
- Cursor supports agents with no repository: omit `repos` and `env` when creating the agent. That fits requirement 3. The plugin sends the note text it read from the vault in the prompt.
- Until Cursor ships a sign-in for third-party apps, the only working path is a key the owner creates in the Cursor dashboard, stored in device local storage and never in the vault. Switch to SSO as soon as Cursor offers one.

## What the chat does

- Read the open note, and search the vault on the device when the answer may be in other notes.
- Send only the note text needed for the question.
- Answer in the Giltmargin chat panel.
- Leave notes unchanged unless the user explicitly asks to insert a reply.

## Mobile rules

All network calls go through Obsidian `requestUrl`. `isDesktopOnly` stays `false`. The plugin id is `giltmargin`. Publish from `gokulnathan66/giltmargin`.

## Do not build

- Any flow that needs the vault to be a Git repository, or a clone, mirror, or remote of the vault.
- A Claude login, Claude Code token reuse, or a client that imitates Claude Code.

## Current code

`0.1.0` asks for a vault repository URL and points a Cursor agent at that repo. That breaks requirement 3. The next change removes the repository and branch settings, reads notes through the Obsidian vault API, and starts Cursor agents with no repository.
