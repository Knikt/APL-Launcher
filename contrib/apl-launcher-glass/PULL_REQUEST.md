# Add pre-blurred glass to the launcher chrome, and a Universal Search sheet

## Summary

- Replaces the live `backdrop-filter` on the dock, the Control Center, the
  app menu and the Sources sheet with **one frozen copy of the artwork**
  that is sliced under each surface by `background-position`.
- Adds a **Universal Search sheet** built from the same material: installed
  apps, films and shows from Cinemeta, and the service that actually carries
  each title in the viewer's country (JustWatch), with a partial render while
  the answer is still arriving.

The look is the "liquid glass" from my CleanFrame launcher: a single pane of
light-edged glass per surface, rather than a tinted rectangle, with the
artwork visible through it and offset to the surface's real position.

## Why

`backdrop-filter` is the most expensive effect on a Tizen set: the blur is
recomputed whenever the layer's content or transform changes, which here means
every focus scale (1.06 on a tile), every panel slide and every dock move.
Four surfaces are blurred at 1920×1080 at once when the Control Center opens.

This patch freezes the backdrop once per artwork and then never filters again.
Per frame it writes `background-position` on the tiles that actually moved, and
nothing on the ones that did not.

## How it works

```
48×27 canvas  ──draw──▶  480×270 canvas  ──toDataURL──▶  background-image
                                                              │
              background-size: 1920px 1080px  ◀───────────────┘
              background-position: -x -y   (the surface's stage rectangle)
```

- The stage rectangle comes from **layout offsets**, not client rects: a
  focused tile is scaled and the panel slides, so a rect would sample the
  transformed box and leave the slice a few pixels off.
- The frozen copy is rebuilt only when the artwork URL changes, debounced
  120 ms, so key repeats never trigger it.
- `<body class="perf">` (the existing performance mode) skips the whole thing
  and keeps the opaque fills.

## Files

| File | What |
| --- | --- |
| `launcher/js/glass.js` | new — the freeze/slice engine, `APL.glass` |
| `launcher/css/glass.css` | new — the material, all of it under `body.glass`, plus the search sheet layout |
| `launcher/js/search.js` | new — Universal Search data and sheet, `APL.search` |
| `launcher/index.html` | one `<link>`, two `<script>` |
| `launcher/js/build.js` | two entries in `"scripts"` (regenerated) |

Existing modules are not modified.

## Rollback

Everything visual is scoped to `body.glass`, which `glass.js` adds on start.
Removing the class in devtools restores the current appearance instantly; not
merging the three files restores it permanently. The search sheet degrades to
a plain scrim without the material.

## Testing

Tested on a 2023 Samsung The Frame (Tizen 6.5) and in the desktop preview:

- dock, Control Center (main / audio / pair / AirPlay), app menu, Sources,
  Sources device picker
- focus scaling, long-press, and the panel open/close transition, with the
  slice staying aligned under the tile
- generated brand cards (no artwork) — the plain fill stays, no slice
- performance mode — no canvas work at all
- search: on-screen keyboard, tabs, partial results then offers, apps with no
  match hidden, provider app chosen by name, missing app reported honestly

Not tested: other panel widths, a landscape transform on `<body>`, or an
artwork served cross-origin without CORS — the last one cannot be read into a
canvas and falls back to the plain fill, as before.

## Licence

Contributed under the project's licence. No third-party assets, fonts, keys or
credentials are included; the two search endpoints are public and keyless.
