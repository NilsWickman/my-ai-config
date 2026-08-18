---
name: demo-images
description: For low fidelity prototypes, use for displaying some distinct alternatives to the user.
disable-model-invocation: true
---

# Design-variant screenshots

Show design options as images instead of describing them. Build one standalone
HTML mockup that borrows the app's **real** theme tokens, express each option as
a CSS block, and screenshot them in a loop. Fast enough that discarded options
cost nothing — the point is that the user picks from pictures, then you
implement only the winner.

Use the running app instead when the change is layout-sensitive (wrapping,
overflow, real content lengths) or when there is only one option to show. The
mockup trades layout fidelity for speed; colors stay exact because they come
from the source.

## Steps

1. **Trace the element to its source of truth.** From the user's screenshot or
   description, find the component, the class that styles the state
   (`resolveThreadRowClassName`-style helpers, `cva` variants, the JSX), and the
   theme block those classes resolve to. Copy the actual values — never
   eyedropper a screenshot or guess a hex. Done when: you can name the current
   styling as code (e.g. `bg-accent/55` where `--accent: #191a1d` on `#000`),
   which usually also explains *why* it reads weakly.
2. **Write the mockup.** One self-contained HTML file: the real token values in
   `:root`, hand-copied geometry (row height, padding, radius, font sizes) and
   enough surrounding rows/sections that the highlighted state has context.
   Each option is a `[data-variant="N"] .target { ... }` block in the same file;
   **variant 0 is the current state**, so the user sees the baseline they are
   comparing against. Done when: flipping `data-variant` by hand switches the
   look and nothing else moves.
3. **Screenshot the loop.** Copy [`scripts/shoot.js`](scripts/shoot.js), point
   it at the mockup and the region selector. Element screenshot, not full page,
   at `deviceScaleFactor: 2`. Reuse an existing `playwright` install if the repo
   has one; otherwise `npm i playwright && npx playwright install chromium` in a
   scratch dir. Done when: `variant-0..N.png` exist, all the same size.
4. **Look at the images.** Read every PNG. Check: the highlighted row is
   actually distinguishable from its neighbours, text stays legible on the new
   background, no variant accidentally renders identical to another or to
   variant 0, and nothing collides with adjacent UI. A variant that fails here
   gets fixed or dropped, not shipped with a caveat. Done when: each image
   defends its own option.
5. **Deliver as a numbered menu.** One short paragraph per variant: the
   mechanism ("3px accent bar plus stronger fill"), what it buys, and the real
   risk (collides with the multi-select fill, reads like the focus ring, too
   loud for this surface). State plainly that these are mockups using the real
   tokens, not the running app. End with **one recommendation and why**, and
   name the file and line where the chosen one gets implemented. Done when: the
   user can answer with a single number.

## Reference

- Absolute paths for the images if the chat renders them inline, and put them
  somewhere durable (a repo `artifacts/` dir, not `/tmp`) — a shared image
  streams from its path and dies when the path does.
- Keep the mockup file next to its output; it is the cheapest way to render
  round two after "like 2, but the bar in the accent color".
- Borrow tokens, never re-declare them by value in the variant blocks. If a
  variant needs a derived shade, express it the way the codebase does
  (`color-mix(in srgb, var(--foreground) 6%, var(--accent))`), so the winning
  variant's CSS is close to copy-paste into the component.
- Both themes matter: if the app has light and dark, shoot both, or at minimum
  check the winner in the other theme before implementing.
- After implementing, offer a real screenshot from the dev instance as
  verification — the mockup proved the color, not the layout.
