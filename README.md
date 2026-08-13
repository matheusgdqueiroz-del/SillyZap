# SillyZap

A WhatsApp Web–style skin for [SillyTavern](https://github.com/SillyTavern/SillyTavern). It turns the chat into a familiar green-bubble messenger — chat list, conversation header, read receipts, date separators and all — without touching your chats, characters or settings.

Toggle it off and SillyTavern comes back exactly as it was.

## Install

In SillyTavern:

1. Open the **Extensions** panel (the stacked-blocks icon in the top bar).
2. Click **Install extension**.
3. Paste this URL and confirm:

```
https://github.com/matheusgdqueiroz-del/SillyZap
```

4. Reload the page (F5).

That's it — the skin turns on by default.

## What it does

- **Light and dark** — both palettes are faithful to the real thing. Light by default; switch to dark, or let it follow your operating system.
- **Full messenger layout** — icon rail, chat list sidebar, conversation header with avatar and status line, and a composer with emoji/attach/sticker/mic buttons that keep their real SillyTavern functions.
- **Real bubbles** — sent messages on the right in green, received on the left in white, with tails, sender grouping, timestamps, blue read receipts and day separators.
- **Group chats** — each incoming bubble in a SillyTavern group is labelled with its speaker, colour-coded per character.
- **Per-character contact cards** — give any character its own display name and photo in the header. Each character keeps its own; switching characters switches the card.
- **Editable chat list** — the list ships with sample contacts to make it look lived-in. Hover any row and click the pencil to change its name, last message, time and photo; the pencil at the top of the list adds new ones; the search box filters them. Or switch them off entirely.
- **Light theme everywhere** — SillyTavern's drawers, character list, popups and prompt manager are repainted to match, so nothing jars when you open a menu.
- **Companion styling** — if you use [Guided Generations](https://github.com/Samueras/GuidedGenerations-Extension) or Choices, their controls are restyled to fit in.
- **Localised dates** — timestamps, weekday names and "Today"/"Yesterday" follow SillyTavern's UI language automatically.

## Where did SillyTavern's menus go?

They are hidden while the skin is on, so the illusion holds. To bring them back:

- click the **⋮** button in the conversation header, **or**
- click the **gear** at the bottom of the icon rail.

Press **Esc** to hide them again.

## Settings

**Extensions panel → SillyZap — WhatsApp Web Skin**

| Setting | What it does |
| --- | --- |
| Enable the skin | Master switch. Off restores stock SillyTavern immediately, no reload needed. |
| Theme | Light (default), Dark, or Match system. Switches live and repaints SillyTavern's menus with it. |
| Show the chat list sidebar | Hide the rail and list to give the conversation the full window. |
| Show sample contacts in the list | Turn off to show only your real, open chat. |
| Show the end-to-end encryption notice | The yellow banner at the top of a conversation. |
| Show read receipts | The blue double ticks on your own messages. |
| Contact status line | Text under the contact name — `online` by default. Becomes `typing…` while a reply generates. |
| Sidebar title | The big heading above the chat list. |
| Restore sample contacts | Puts the shipped sample list back. |

Contact name and photo for the **open chat** are edited separately: click the avatar in the conversation header, or the pencil on its row in the list.

## Notes

- Character **expression sprites** are hidden — they have nowhere sensible to go in a messenger layout. Turn the skin off if you want them back.
- Photos you upload for contacts are cropped to 120×120 and stored inside your SillyTavern settings, so keep the count reasonable.
- Below 860px wide the rail and list hide themselves automatically and the conversation goes full-screen.
- Every colour comes from a `--wa-*` custom property declared in two blocks at the top of `style.css`. If you want to restyle something, change a variable rather than a literal — that keeps both themes in step.

## Requirements

SillyTavern 1.12.0 or newer, in a browser with `:has()` support (any current Chrome, Edge, Firefox or Safari).

## Development

The chat wallpaper is a generated seamless tile. To regenerate it:

```bash
node tools/gen-doodle.mjs
```

## Disclaimer

SillyZap is an independent, unofficial theme. It is **not affiliated with, endorsed by, or connected to WhatsApp LLC or Meta Platforms, Inc.** "WhatsApp" is a trademark of its respective owner and is used here only to describe the visual style this theme imitates. No WhatsApp code, assets or fonts are included — every icon and graphic is drawn with Font Awesome or generated SVG.

## Licence

[MIT](LICENSE)
