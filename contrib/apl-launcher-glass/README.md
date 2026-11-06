# Liquid glass for the launcher

A pull request candidate: the material from CleanFrame's Smart Home
Control Centre, plus a Universal Search sheet that uses it.

Nothing here is brand new artwork or a new dependency. It is one behaviour —
**freeze the backdrop once, slice it under each surface** — written in ES5 for
Tizen, and it replaces the live `backdrop-filter` the launcher uses today.

## What it does

| Surface | Before | After |
| --- | --- | --- |
| Dock | `backdrop-filter: blur(50px)` over the full artwork | slice of one 480×270 frozen copy, offset to the dock |
| Control Center tiles | `blur(30px)` per tile, re-run on each focus scale | same frozen copy, one slice per tile |
| Control Center panel | flat tint behind the column | one pane behind the whole column |
| Sources cards / dim | `blur(40px)` full-screen | frozen copy, plus a plain scrim |
| App menu | `blur` | frozen copy |
| Search sheet | did not exist | full-stage frozen copy behind the sheet |

The blur happens once per artwork, off the animation path: a 48×27 copy is
drawn up to 480×270 in a canvas, and CSS upscales it. Focus, panel slides and
sheet transitions only change `background-position`, so the compositor never
runs a filter.

## Files

```
launcher/js/glass.js     the engine: freeze, slice, paint (221 lines)
launcher/css/glass.css   the material, scoped to body.glass, plus the search sheet (507 lines)
launcher/js/search.js    Universal Search: data + sheet (715 lines)
INTEGRATION.md           the two link/script tags and the build list entry
PULL_REQUEST.md          the description to paste into the pull request
```

## Trying it without a TV

Open the launcher as usual (`js/preview.js` still works: arrows, Enter, Esc).
Focus the dock, open the Control Center, open Sources. On a desktop the
material follows the artwork on screen; on the TV it is the same code path.

## What it does not do

- No live blur anywhere on the animation path, including the `mode-grid`
  background (the launcher already ships pre-blurred art there).
- No change to focus, layout, navigation, the catalogue or preferences.
- No bundled fonts, images, API keys or credentials. The search endpoints
  (Cinemeta, JustWatch) are public and keyless.

## Licence

Contributed under the project's own licence. The code is original to
CleanFrame, which publishes its source, and contains no third-party assets.
