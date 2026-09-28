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
- v12: every effect set (metallic, chrome, glitter, jewel, neon, glow, pulse, smoke, clouds) has an "Any color" button:
  pick the effect, then any color from this page's color guide, the book palette, the full spectrum, neutrals, skin and
  earth tones and every palette (about 280 colors).
- Pop is back to the v8 Pop Pencil (each pass adds a little more) with one two-way height slider: left presses in,
  the middle is flat (smooths areas back), right raises. Pop stays strictly inside the one line-enclosed area where the
  stroke starts, like Fill; every black line is a wall, so small circles and dots pop on their own. Clouds, lightning
  and other shapes drawn in the sky pop on their own. Coloring or filling a popped area
  changes its color and keeps its height and shading.
- v13: the open background pops again, raised or pressed in (3D Pop tap, Pop Pencil + slider, Pop Erase, both modes).
  Only the background changes: clouds, lightning and other shapes stay flat and read as framed by a recessed edge.
- v13: the Pop height slider controls the one area you last drew in or tapped (including the background); its thumb
  shows that area's height, and every other popped area keeps its own height.
- v13: the color guide is a row of colored pencils (numbered in Color by Number) with a color wheel at the end for every
  other color; hover a pencil to see its color name (a tap or long-press shows it briefly on touch screens).
- v13: chrome shimmer travels along each chrome stroke the way it was drawn, following curves (tap fills keep the
  diagonal sweep). The Chrome box has a Speed slider (slower to faster, remembered) next to the Shimmer amount.
- v13: in every effect box the most recent pick wins: a listed pencil replaces an Any color pick (and the other way round),
  and the round Any color swatch shows the active color of that effect.
- v13: Lightning pencils (9 colors plus Any color): a calm neon glow with irregular lightning flashes where the centre of
  the stroke burns white-hot and the color glows around it, fading outward. Flash and Speed sliders; works with Mix, Pop,
  undo and both modes, and stays inside the lines.
- v13: every effect Speed slider (chrome/metallic/jewel shimmer, glitter twinkle, neon, glow, pulse, lightning) goes
  about 3x slower than before at its slow end; defaults are unchanged. Every effect slider and the Pop height slider
  has a small number box: type a value such as 0.3 (clamped to the slider's range, remembered).
- v13: lots of chrome no longer freezes the shimmer: all chrome colors are drawn in one batch, so the frame cost stays
  small however many chrome strokes and Any-color picks there are, also after a reload.
- v14: texture pencils. Wood (oak, walnut, cherry, pine, maple, driftwood), Brick (red, tan, white), Stone (slate, granite, sandstone, marble, cobblestone) and Flowers (blossom, daisy, lavender, forget-me-not, rose, mint sprig): a flat color with a subtle, small, page-anchored pattern, contained in the lines, with Any color, Mix finishes, Pop, undo and Color by Number support, each in its own set box with a looping preview.
- v15: Fur & Hair pencils: short fur, long fur, straight, wavy and curly hair. Strands follow the direction you drag, over a flat base color, contained in the lines. Any color opens a fur and hair range first (blonde, golden, calico orange, ginger, cream, tans, browns, black, grays, white) and keeps the chosen style. Fills, Pop, undo, Mix and Color by Number work too.
- v16: the bottom bar follows the tool. A tag and hint name the tool, and the bar slides in fresh whenever you switch. Pencil shows the drawing pencils, Fill the fill colors, Pop Fill and Pop Pencil their raise/inset and height options plus pencils, and Eraser and Pop Erase their options. Pencil (and brushes), Fill (shared with Pop Fill) and Pop Pencil each remember their last pencil or color. Free Color no longer shows the numbered guide row (Color by Number keeps it), and the color wheel sits at the end of the pencils. 3D Pop is now Pop Fill: it sits next to Fill with a paint-bucket icon and a raised accent, and it works like Fill. One tap raises the line-enclosed area, or presses it in when Inset is chosen, at the slider height, and the slider then controls the last area you tapped. With Color while popping on, the same tap also fills the area with the current pencil or effect. Popped shapes keep the real color, vivid on the lit side, and the shadow side is a darker shade of that color, both raised and pressed. Pop Fill, Pop Pencil and Pop Erase all work in the 3D view (both modes), and the 3D relief no longer washes out the lit side. Every stroke or fill of an effect now moves on its own: it gets its own seed, phase, speed and direction (from the stroke) and a light type (sweep, bloom, star glint, ripple, double band, dotted chaser or rotating beam), and these are kept after a reload. Glitter, textures, chrome, metal, jewel, smoke and clouds use page-size non-repeating noise, so there is no visible tile or grid, even across a full page. Smart Grab: the Auto | Hand | Draw switch sits by the zoom buttons. Auto (the default) switches to drawing when you zoom in and to the grab hand when you zoom out; one setting (grabRule) flips that. Holding Space gives a quick hand, and two-finger pinch still works. In the Any color grid and the color wheel, palette packs you don't own are shown locked (padlock, dimmed, tap to open the upgrade), and a glowing divider separates the palette groups. New bonus page: Ninja Kat: Dojo at Sunset (always unlocked, deep link ?page=ninja-kat).
- Start over: wipes the whole page back to blank (colors in both modes, effects, pops and 3D heights, line settings)
  after a confirm, and deletes that page's saved copies so a reload doesn't bring it back. Other pages aren't touched.

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
