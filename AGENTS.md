# Giltmargin

## Goal

Giltmargin is an Obsidian plugin and nothing else. It runs inside Obsidian on iPhone, Android, and desktop. The user opens a chat in the app and asks about their notes. The plugin reads those notes from the vault on the device and shows the answer in the chat.

There is no vault Git repository in this product. Do not ask the user to put their vault on GitHub, GitLab, or any other remote. Do not clone the vault, add a git remote, or send a repository URL to Cursor. The notes stay in Obsidian. The plugin is the only thing that reads them.

## What the chat does

- Read the open note, and search the vault on the device when the answer may be in other notes.
- Send only the note text needed for the question.
- Answer in the Giltmargin chat panel.
- Use a Cursor cloud agent for the answer, billed to the user's Cursor plan. The Cursor key stays in device local storage, never in the vault.
- Leave notes unchanged unless the user explicitly asks to insert a reply.

## Mobile rules

Obsidian on a phone has no Node.js and cannot start another program. All network calls go through Obsidian `requestUrl`. `isDesktopOnly` stays `false`. The plugin id is `giltmargin`. Publish from `gokulnathan66/giltmargin`.

## Do not build

- A Claude Code or Claude.ai subscription login inside the plugin. Anthropic allows that login only in Claude and Claude Code.
- A terminal, a home server, or a relay that runs Claude Code.
- Any flow that needs the vault to be a Git repository.

## Current code

`0.1.0` still asks for a vault repository URL and points a Cursor agent at that repo. That design is retired. The next change removes the repository and branch settings and reads notes through the Obsidian vault API instead.
