---
name: rota
description: Read and plan the user's wardrobe in Rota with the rota command, and show pictures of their garments. Use when the user asks what to wear, wants to discuss or plan an outfit for a day or an occasion, asks about their clothes, saved outfits, laundry, the weather for getting dressed, or what they wore before, or wants an outfit saved, planned, or recorded as worn.
---

# Rota

Run `rota --help` for commands and `rota <command> --help` for options. Output is JSON on stdout. Errors are JSON on stderr, `{"error":{"tag","message"}}`, and exit 1, or 2 for invalid arguments.

- If a command reports `NotSignedIn`, ask the user to run `rota login` in their own terminal. It opens the browser and waits for the user to approve the code there, so don't run it yourself. `rota status` shows who is signed in.
- Show garments to the user. `rota garments picture <id...>` saves pictures on this machine and prints their absolute paths; embed each one in your reply as `![name](/absolute/path)`. Use `--width 320` for several garments at once and the default 640 for a closer look. A garment without a picture has `path: null`.
- Use the ids that commands print. `rota garments list` returns the active wardrobe with each garment's slots, colours, warmth and formality from 1 to 3, laundry state, and wear counts. Garments with `inLaundry: true` aren't available until `readyOn`.
- An outfit has at most one garment per slot: `bottom`, `under`, `top`, `dress`, `over`, `scarf`, `hat`, `shoes`, and `bag`. A complete outfit has a top and a bottom, or a dress.
- `rota day show [today|tomorrow|YYYY-MM-DD]` shows the weather, Rota's own proposal, the plan, the occasion, what was worn, and the laundry for that day. `rota forecast` covers the next days, and `rota history` shows what was worn on earlier days.
- Only today and tomorrow can be planned. `rota day plan` replaces the whole plan, and `--based-on` names the saved outfit it starts from. For an occasion further ahead, save the outfit with `rota outfits save` and plan it once the day is tomorrow.
- `rota day occasion <day> <text>` notes what the day is for, and Rota's proposal takes it into account. An empty text clears it.
- `rota day wear` records today's outfit as worn, which counts towards each garment's wears and its next wash. Today can be recorded only once, so record it only when the user says they wore the outfit.
- `rota outfits save --id <id>` replaces the name, garments, and collections of a saved outfit, so pass every collection it should keep. It keeps the favourite mark; change that with `favourite` and `unfavourite`. Delete an outfit only when the user asks.
