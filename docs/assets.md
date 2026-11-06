# Asset generation

The app includes all runtime JPEGs, thumbnails, registered material fields, public fonts and icons. A clone can preview the current app without the original Downloads folder or any generation step. Keep photo and icon credits and third-party licences with the assets. The private Pangram overlay is described in [development](development.md).

## Current List and Dock materials

The 0.6 runtime uses fifteen photographs. Each has a background, a thumbnail, a small panel backdrop and four full-stage material JPEGs. The runtime never generates blur or reads photo pixels. Generate selected materials with:

```sh
node scripts/build-materials.mjs summit,goldcoast,sydney,amber,mint,alpine
```

Omit the argument to regenerate every catalogue entry. Output goes to ignored `.local/materials/builder/`. Review it, then copy `*-panel.jpg` to `app/assets/wallpapers/` and the other four JPEGs to `app/assets/materials/`.

- `field-blur`: 28px blur, saturation .92, mirrored edge padding and highlight soft clipping.
- `field-frost`: the same registered crop with 42px blur.
- `field-clear`: 2px blur and saturation 1.06, with no baked veil.
- `study-soft`: the retained name for the reviewed Dock Soft recipe, including the lower scrim, 14px blur and compressed local variation. The original nine preserve their calibrated tint. New photos use a bounded tint selected from the dock band.

All fields use the centred 1920 x 1080 crop. The small panel backdrop comes from that same Frost field. The six new backgrounds use baseline sRGB JPEG at quality 90 with full chroma; thumbnails use quality 85. Their originals remain unchanged.

`app/assets/wallpapers/catalog.js` stores names and surface parameters; `app/assets/adaptive-ink.js` stores offline colour choices. New photographs need a rendered review of their List, Dock, clock, controls and all three materials before their metadata is accepted. An average image colour alone does not establish readable text.

## Icon metrics

`node scripts/build-icon-metrics.mjs` measures the SVGs in an aspect-preserved 240px viewport, matching the CSS mask renderer. Output is ignored `.local/materials/metrics.js`; review before copying it into `app/assets/icons/metrics.js`. The TV reads these bounds and does not scan icon pixels.

## New or replacement photographs

Full-size original photographs are local inputs and are not required for glass regeneration: the bundled 1920px JPEGs are the rendering inputs. To recreate JPEGs/thumbnails from the original supplied filenames on a Mac:

```sh
python3 scripts/prepare-wallpapers.py /path/to/originals --ids summit,goldcoast,sydney,amber,mint,alpine
```

The retained generator covers all fifteen filenames and writes `.local/materials/wallpapers/`. The original nine keep their macOS `sips` recipe. The new six require Pillow and use the reviewed centred crop and JPEG settings; Pillow is a development dependency only. Supply Golden Hour as `big-sur-golden-hour.jpg` in the originals folder. Install Pillow in a local Python environment when using the six newer photos.

For another photo, add its source/credit to `SOURCES.json`, prepare its background and thumbnail, add the gallery entry in `catalog.js`, generate the four registered materials and panel backdrop, then measure and review its foreground metadata. Keep the crop identical across all assets. Run source and browser checks before packaging.

## Bundled backdrops

YouTube's tile has no public trending list, so its backdrop ships with the widget. `app/assets/backdrops/youtube.svg` is the original CleanFrame drawing and the public default; it is also what a clone previews with no generation step. `app/assets/backdrops/catalog.js` names the file each build uses. `scripts/font_assets.py` regenerates that catalogue at package time and, for the private build only, adds `.local/youtube-backdrop.jpg` as `assets/backdrops/youtube.jpg`.

The private JPEG is derived from a published screenshot of the YouTube TV splash; see [asset sources](asset-sources.md). It is a third party's artwork, so it stays in ignored `.local/` and never enters the public export, which keeps the SVG. The preview serves the same generated catalogue as the package, so `npm run dev` shows the private artwork and `npm run dev:public` shows the public drawing. Keep any replacement at 1920 x 1080; the stage draws it with `object-fit: cover` and the `.bd-scrim` gradient on top.

## Dock tile artwork

`app/assets/tiles/catalog.js` maps each dock brand to its artwork. The file in `app/` is the public build: an empty map, so the tiles draw CleanFrame's own marks. `scripts/font_assets.py` regenerates it at package time and, for the private build only, copies 504 x 316 JPEGs from ignored `.local/tiles/` into `assets/tiles/`. Public exports keep the drawn marks; see [asset sources](asset-sources.md) for the private inputs.

`.local/make_app_tiles.py` composes those JPEGs from 512 px store artwork. It has five modes:

- `cover`: scale the icon to tile width and centre-crop vertically. Used where the brand art is full-bleed (Apple TV, JioHotstar, Nuvio, TizenTube).
- `fit`: scale to tile height and continue the icon's own side columns into the margins, dimmed at the outer edge (Alexa).
- `wide`: like `fit` without the dimming, so a wordmark split across the top and bottom of a square icon stays whole (SonyLIV, Apple Music, Samsung TV Plus).
- `mark`: crop the measured content box from the icon's square plate and place it on a flat brand colour (Netflix, YouTube, Prime Video, Spotify, Moonlight, YouTube TV, YouTube Kids).
- Drawn tiles: Stremio and the TV Internet entry have no wide store artwork, so their marks are drawn at tile size.

Each tile is reviewed on `.local/tiles/sheet.png` at 252 x 158 before packaging: check that the mark is centred, no wordmark is cropped and the tile edges meet the dock background without a seam.

## Tile corners and the shadow plate

`app/assets/tile-squircle.svg` is the continuous-curvature mask used on `.appletv-card`, 252 x 158 in its viewBox. `border-radius: 30px` remains the fallback if a renderer rejects `mask-image`.

A CSS mask also clips `box-shadow`, so the card carries only an inset rim. The lift shadow and the per-brand focus glow are painted by `.appletv-tile::before`, a plate the size of the tile that scales with the focused card and reads `--app-glow` from `.appletv-tile-<brand>`. Keep that split when changing focus shadows, and set the glow on the tile rather than the card. `.a-text` mode hides the plate along with the card.

Source pages and licence observations are recorded in [asset sources](asset-sources.md).
