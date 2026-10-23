# The Kunnin' Kodex Claude Project

A Claude Project (claude.ai → Projects) that answers rules questions on your Claude subscription, with the app handing it the question.

## Set up once
1. In Claude, create a Project (e.g. "Kunnin' Kodex").
2. Paste the text of `instructions.md` into the Project's instructions.
3. Add these files to the Project's knowledge: `project/00-start-here.md`, `project/kodex-lists.md`, `rules/core-rules.md`, and the GW and codex files (`core-and-key-rules-updates.md`, `event-companion.md`, `pack-*.md`, `codex-*.md`), which are sent to you separately and are not on the public site.
4. Optional skills (Settings → Capabilities → Skills, with code execution on): upload `project/skills/kodex-dice-maths.zip` and `project/skills/kodex-game-review.zip` (make.js builds them).
5. Copy the Project's link (claude.ai/project/…) into the app: Settings → Rules questions → Your Claude Project.

## Use
The first time, the link may open claude.ai in a browser view rather than the Claude app: sign in there once, or long-press the link to open it in the Claude app.

Tap ? in the app, type the question, tap "Copy and open Claude", start a chat in the Project and paste. "Ask about this" on a unit, stratagem or rule adds its full text to what is copied.

## When a list changes
Each release rebuilds `kodex-lists.md` (`node project/make.js`). Replace that file in the Project; its first line shows the data version.
