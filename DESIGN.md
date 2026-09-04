# Design

Rota is a wardrobe ledger that happens to think. It is set like a tailor's order book: paper ground, ink type, hairline rules, square corners, one yellow signal. Nothing floats, nothing is rounded, and colour belongs to the clothes, not to the interface.

This file states the intent. The values live in `apps/web/src/styles.css` and nowhere else; the shared control recipes live in `apps/web/src/shared/ui/classes.ts`. Read this before UI work, and follow it.

## The rules that hold it together

- **No cards, no shadows, no radius.** A section is separated from the next by a hairline rule and by space. A control is a rectangle with a 1px edge. There is nothing for a radius to soften, so nothing is rounded, ever — not a button, not a swatch, not a photo frame.
- **The garment is the only picture.** Photos and studio renders are the one image on any screen. They sit in a 3:4 frame on the paper ground with no border of their own. Everything else is type and rules, so the eye goes to the clothes.
- **The tally is the one mark.** A garment's place in its rotation is drawn as tally strokes — worn days in ink, remaining days as ghost strokes — wherever the garment appears. It says "day 3 of 4" without a number, and its label says it in words for anyone who cannot see the strokes. Past seven strokes the digits take over.
- **One yellow, for one thing.** The signal colour appears on the primary action of the day (Wear this), as the underline of the current place in the navigation, and as the rule that draws in when the day is logged. It never decorates. It never carries meaning on its own: the button has words, the nav has `aria-current`, the rule has a heading above it.
- **An eyebrow opens a section.** Small letterspaced capitals name a section or a control; the display face carries what matters underneath. Slot names, the state of a garment (fresh, continuing), and the day's labels are eyebrows.
- **Colour swatches are the garment's colours.** The small squares beside a garment are its own colours from the reading, dominant first. They are the only chromatic elements apart from photographs and the signal. A garment without a picture shows its dominant colour as the whole frame.
- **A field is a rule with type on it.** Inputs and selects have a 1px edge in the strong rule colour, deepening to ink on focus. Placeholders are examples and are set fainter than an answer. A number is set in tabular figures.
- **One frame.** Every page sits in the same frame (`frameClass`): 5 rem side padding on a phone, 8 on a tablet, a maximum width a rota board needs. The masthead and the tab strip share it, so the brand and a page's first word start on the same line.
- **The phone comes first.** The tab strip is at the foot of the screen on a phone and in the masthead on a wide screen. The one action of the morning sits in a bar above the strip, so confirming an outfit is one thumb away. Every interactive target is at least 44px tall.
- **Destructive actions ask in place.** Nothing pops up. A press arms the control and says what will happen; the second press does it; leaving it alone disarms it.

## Type

Instrument Serif for display — the day, the garment name, the headline the model wrote — and Instrument Sans for everything set as text. The three roles are classes in `styles.css`: `type-display`, `type-eyebrow`, `type-data` (tabular figures for temperatures, counts, and dates). Faces are named nowhere else.

## Colour

Paper is a very light cool grey, not white; ink is a near-black with a little blue in it. Three greys between them (`ink-muted`, `ink-faint`, `rule`) carry the whole hierarchy, and each one that can carry text clears 4.5:1 on paper. `rule-strong` edges controls at 3:1. The signal yellow clears 4.5:1 with ink type on it. There is no dark mode: a wardrobe is looked at in the morning, and a light page is the right one for judging a colour.

## Motion

Two animations, both short and both optional: the newest tally stroke draws in when an outfit is logged, and the yellow rule under "Today is dressed." fills across. Everything else is a colour transition under a pointer. Both animations are off under `prefers-reduced-motion`.

## Accessibility

WCAG 2.2 AA is the floor. `apps/web/a11y/routes.a11y.ts` scans every route reachable without signing in on desktop and phone. Every picture has a name; every chart is an SVG with a title; every state that is drawn (the tally, the calendar swatch, the board's filled square) is also said in words. Nothing is communicated by colour alone.

## Changing it

Change the tokens in `styles.css` and the recipes in `classes.ts`; do not add a colour, a radius, or a shadow at a call site. If a page needs a shape this file does not describe, add the shape here first.
