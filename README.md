# Waaagh Codex

A phone-first Warhammer 40,000 (11th edition) army reference sheet: the printed
New Recruit list + Wahapedia stratagems, made searchable. Pick an army, then search it,
or open Units, Stratagems, Ranged weapons, Melee weapons, Abilities or Rules & keywords.

| File | What it is |
|---|---|
| `data.js` | every army, plus the faction and core rules they use. **Edit this to add a list.** |
| `app.html` | the app (published as the Claude artifact as-is) |
| `build.js` | builds `index.html`, `version.json` and the `sw.js` stamp from `app.html` + `data.js` |
| `index.html` | generated: `app.html` wrapped as a full page with the home-screen tags |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | home-screen install and offline support |
| `version.json` | generated: installed copies compare it with their build stamp and reload |

## Adding an army

1. Add the army to `ARMIES` in `data.js` (units transcribed from the New Recruit PDF). Add any
   new faction, detachment (rule, enhancements, stratagems), rule text to `RULES`, and keyword
   spellings to `RULE_ALIASES` or the faction's `aliases`.
2. Bump `VERSION` in `data.js` (shown in the app; the reload stamp is automatic).
3. `node build.js`
4. Commit and push; republish the artifact from `app.html` with `data.js` alongside.

## Home-screen install

GitHub Pages serves this repo at `https://marastefanic-cmd.github.io/warhammerapp/`
(Settings → Pages → Deploy from a branch → `main`, `/ (root)`). Open that URL in Safari →
Share → Add to Home Screen. The installed app fetches the newest version every time it opens
(network-first service worker, plus a `version.json` check when it comes back to the
foreground), so it never needs reinstalling.

## Where the text comes from

- Units, weapons and abilities: the New Recruit PDF export of each list.
- Detachment rules, enhancements and all stratagems (detachment and core): Wahapedia's
  wording, checked against PDFs of the Wahapedia pages.
- Weapon keywords and core abilities: the BSData wh40k-11e files. Explanations written for
  the app (Hunter, Mobile, the Lethal Hits suffix) are labelled "App note".
