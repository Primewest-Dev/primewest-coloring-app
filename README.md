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
- Contour shine: chrome, metallic and jewel follow the shape of each area (and any Pop Pencil / 3D height), with
  a slow glint sweeping across, soft bloom and small twinkles. Smoke is full, layered and curling; clouds are
  puffy billows with light tops and shaded undersides.
- Show ideas (Free Color, off by default and remembered): empty areas softly pulse a suggested color; the arrows
  switch between the color guide and the palettes. An area stops pulsing once you color it.
- Color while popping (on by default): the Pop Pencil also paints with the pencil or effect you picked, so a
  chrome pop is raised and mirrored at once.
- Natural colors: hover over an area (or long-press on touch) to see true-to-life colors in the small sample bar,
  such as skin tones for hands, wood browns, sky blues. Tap one to pick it.
- Lines: fade the line art from black to invisible, recolor it (a chosen color, or Auto = a darker shade of the
  color next to each line), or hide it for a painted look. Stays crisp when zoomed, is included in Save,
  can be undone and is saved with the picture. The button glows when a picture is complete.
- Every pencil has a name: hover (or long-press) a pencil or number swatch for its name and effect.
- v11: chrome is a live shimmer (a slow color shift and flowing light on top of the glint), and glitter has real
  sparkle (points that pop on and off all over the glittered area). Small sliders sit inside the pencil boxes and are
  remembered: Shimmer (chrome, metallic, jewel) and Sparkle (glitter) go from Off (standard, still) to Full; the Pulse
  box has Speed and the Glow box has Strength. With the system "reduce motion" setting, shimmer and sparkle start at
  half strength.
- More colors: Spectrum Light, Spectrum and Spectrum Deep (the full hue wheel), Neutrals, Skin Tones and Earth Tones,
  12 chrome pencils, and a Chrome finish button that turns any color you pick into chrome.
- Color by Number has the full toolbar and pencil boxes. The numbers still choose the color; a pencil adds its finish
  (chrome, glitter, pulse, glow, metallic, jewel, smoke, clouds, gradient or a Mix) and the effect animates. Finished
  areas count as correctly colored. The same free tries and locks apply as in Free Color.
- The set switcher arrows (and the Show ideas arrows) stay in place whatever the set name, count or badge.

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
