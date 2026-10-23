# The Kunnin' Kodex Claude Project

A Claude Project (claude.ai → Projects) that answers rules questions on your Claude subscription, with the app handing it the question.

## Set up once
1. In Claude, create a Project (e.g. "Kunnin' Kodex").
2. Paste the text of `instructions.md` into the Project's instructions.
3. Add these files to the Project's knowledge: `00-start-here.md`, `kodex-lists.md`, `core-rules.md`, and the GW and codex files (`core-and-key-rules-updates.md`, `event-companion.md`, `pack-*.md`, `codex-*.md`; sent separately, not on the public site).
4. Optional skills (Settings → Capabilities → Skills, with code execution on): upload `skills/kodex-dice-maths.zip` and `skills/kodex-game-review.zip`.
5. Copy the Project's link (claude.ai/project/…) into the app: Settings → Rules questions → Your Claude Project.

## Use
Tap ? in the app, type the question, tap "Copy and open Claude", start a chat in the Project and paste. "Ask about this" on a unit, stratagem or rule adds its full text to what is copied.

## When a list changes
Each release rebuilds `kodex-lists.md` (`node project/make.js`). Replace that file in the Project; its first line shows the data version.
