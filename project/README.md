# The rules judge: a Claude Project

A Claude Project (claude.ai → Projects) that answers Warhammer 40,000 11th edition rules questions for any faction, on your Claude subscription. Its instructions make it look up the current rule every time (GW's Faction Packs and FAQs, Wahapedia's 11th edition pages), so it does not go stale; the app can copy a question with your list as extra context.

## Set up once
1. In Claude, create a Project (e.g. "Rules judge"). Goal and context can stay empty.
2. Paste the text of `instructions.md` into the Project's instructions.
3. Add two files to the Project's knowledge: `core-rules.md` and `detachment-dispositions.md`.
4. Skills (Settings → Capabilities → Skills; code execution and web search on): upload `skills/kodex-rules-lookup.zip`, and optionally `skills/kodex-dice-maths.zip` and `skills/kodex-game-review.zip`.
5. Turn on web search for the Project's chats.

## Use
Ask in a new chat in the Project; no need to say the game or edition. From the app: tap ?, type the question, tap Copy, open the Project in Claude and paste it into a chat.

## Keeping it current
Faction rules are read live each time. The two files carry their date: ask the Project "is anything out of date?" now and then. If core-rules.md or detachment-dispositions.md is older than GW's newest documents, take the new copies from this folder (each release rebuilds them: `node project/make.js`) and replace them in the Project.
