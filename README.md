# EmberPost Coloring App (prototype)

Offline-capable web app (PWA): Color by Number, Free Color and a story/unlock journey for three EmberPost chapters.

Open: https://primewest-dev.github.io/primewest-coloring-app/

## Features
- Line Lock (soft edge resistance), deep zoom up to 8x with crisp vector lines, color helper and ideas.
- Pencil sets: book palette, 8 themed palettes, metallic, chrome, glitter, jewel, neon, glow, pulse,
  Rainbow & Gradients, smoke, clouds, and brushes. Every set box has a live animated preview strip.
- Living effects keep moving on the page after you draw, in normal 2D as well as 3D: chrome is a live mirror
  (it reflects your picture, its light band keeps turning and shifting color, and it follows device tilt or the
  mouse), glitter sparkles, jewels shimmer, pulse and glow send bands of light through the color, neon hums,
  smoke drifts, clouds billow, and gradients flow along the stroke. With "reduce motion" on, a still frame is shown.
- Mix: layer a finish, an animation and particles on one pencil.
- 3D: 2D / 3D switch (3D by Number, 3D Free Color). Per-scene depth templates made with Depth Anything V2 Small.
  Chapter 4 is free in 3D. Tools: Pop Pencil (Raise / Inset, a little higher with each pass, up to a cap),
  Pop Erase and the 3D idea preview.

## Saving and updates
- Autosave: every scene's work (colours, effect layers, pop / inset heights, Pop Pencil) is saved about 1.5 s after each change, every 20 s while you work, and when the tab is hidden or closed. It goes to localStorage and to IndexedDB (versioned format, last 3 snapshots per scene), so an update or a full localStorage never loses work. A small "Saved ✓" shows when it is stored.
- Updates: the offline cache is network-first (always the newest release when online, the cached copy when offline). If an old cached page ever meets a newer script, the app clears its cache once and reloads instead of breaking.

## Purchases (demo only)
No payment is taken. Products: pencils, palettes, effects3d, smoke, clouds and gradients. Each has free tries.
Payment and licensing hooks are in `premium-config.js`. Codes in that file are public, so real licensing needs a server.

## Owner test unlock (remove before selling)
Type `PRIMEWEST-OWNER` into any "Have a code?" field (store sheet or Settings) to unlock everything on that device.
Owner test bar: https://primewest-dev.github.io/primewest-coloring-app/?owner=primewest (Unlock all / Re-lock).
Both are controlled by one block at the end of `premium-config.js` marked REMOVE BEFORE SELLING.
