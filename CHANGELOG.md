# Changelog

## 1.1.0

### Added

- **Dark theme.** New **Theme** setting: Light (default), Dark, or Match system. Existing installs stay on Light. The whole palette now lives in `--wa-*` custom properties, so both themes share one set of rules.

### Fixed

- Checkboxes in SillyTavern's menus were an unreadable black box with a black tick — there was no way to tell what was enabled. They are now an empty box that fills messenger-green with a light tick when checked.
- Settings section headers ("UI Theme", "Chat/Message Handling", …) were dark text on SillyTavern's white-to-black gradient. They are now a flat green plate with matching text in both themes.
- Switching theme left some elements on their old colour. Chromium keeps a stale `background-color` when the custom property behind it changes while a non-zero `transition` covers that property; the swap now runs with transitions suppressed for a frame.

## 1.0.0

First public release.

- Messenger layout: icon rail, chat list sidebar, conversation header, restyled composer.
- Chat bubbles with tails, sender grouping, timestamps, read receipts and date separators.
- Group chats label each incoming bubble with its speaker.
- Per-character contact name and photo overrides.
- Editable, searchable chat list with sample contacts.
- Light theme for SillyTavern's drawers, character list, popups and prompt manager.
- Optional styling for the Guided Generations and Choices extensions.
- Dates, weekdays and times follow SillyTavern's UI language.
- Responsive down to phone widths; the rail and list hide themselves below 860px.
- Turning the skin off removes every injected node and restores SillyTavern untouched.
