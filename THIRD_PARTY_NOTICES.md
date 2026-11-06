# Third-party notices

The root MIT licence covers CleanFrame's original code and documentation. Third-party material retains the terms below. Keep these notices and the adjacent licence texts when sharing source or a build.

## Fonts

| Material | Terms and source record |
| --- | --- |
| Manrope | SIL Open Font License 1.1; `app/assets/manrope-OFL.txt` |
| Geist and Newsreader | SIL Open Font License 1.1; licences beside the files in `app/assets/fonts/`, with exact sources and hashes in `app/assets/fonts/SOURCES.json` |
| Optional PP Neue Montreal, PP Mori and PP Pangram Sans | Proprietary. Binaries stay in ignored `.local/` storage and are excluded from Git and public exports. The optional local overlay requires the user's own permission to use and embed those files. |

The public app uses Manrope, Geist and Newsreader. A personal widget containing proprietary fonts must stay private. See [Pangram's licensing information](https://pangrampangram.com/pages/eula).

## Icons and trademarks

| Material | Provenance and terms |
| --- | --- |
| Simple Icons service marks | CC0; exact revisions and adaptations in `app/assets/icons/SOURCES.json` and `ADDITIONAL-SOURCES.json`. The CC0 text is retained beside the icons. |
| Disney+, ABC and SBS marks | [Custom Brand Icons](https://github.com/elax46/custom-brand-icons), MIT. The retained licence is `app/assets/icons/CUSTOM-BRAND-ICONS-LICENSE.txt`. ABC and SBS sources were replaced during the public-source review. Exact revisions, source files and extraction/recolour notes are in `SOURCES.json`. |
| Art, apps, settings and home outlines | Original CleanFrame drawings, covered by the project's MIT licence. |

Brand marks identify services. Their owners retain trademark rights; this project claims no endorsement or affiliation. The older Australian TV icon archive's GPL text is retained for historical provenance only; no current icon uses that archive.

## Photographs and derived materials

The fifteen photo pages were individually checked on 20 October 2026. Each displayed its credited author and free use under the [Unsplash License](https://unsplash.com/license). The [asset source register](docs/asset-sources.md) links every page. Runtime paths are in `app/assets/wallpapers/SOURCES.json`.

Photographers retain their rights. Wallpapers, thumbnails, panel backgrounds and material fields derive from the credited photographs and retain their terms. The Unsplash licence permits copying, modification and distribution subject to its restrictions, including on selling unmodified images and building a competing image service.

## Search and ambient data

| Service | Use and terms |
| --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Current weather for the Home status header. Open-Meteo data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the public API has its own usage terms and rate limits. |
| [ipwho.is](https://ipwho.is/) | Approximate IP-based location for the weather request. No device identifier is stored or sent by CleanFrame. Subject to the service's terms. |
| [geolocation-db.com](https://geolocation-db.com/) | Fallback approximate IP location when ipwho.is is unavailable. Subject to the service's terms. |
| [JustWatch GraphQL](https://apis.justwatch.com/graphql) | Regional streaming availability and provider deep-link URLs used by Search. This is an undocumented endpoint used by the public JustWatch site, not a stable partner API. Data remains subject to JustWatch's terms; CleanFrame is not affiliated with JustWatch. |
| [Cinemeta](https://v3-cinemeta.strem.io/) | Movie and series metadata used by Search. Community-provided Stremio add-on data; no affiliation. |
| YouTube Innertube search | Public YouTube search endpoint used to find videos. YouTube and its marks belong to Google; no affiliation. |

The weather line is omitted if these services are unavailable. Search falls back to an app search or a last-resort provider choice rather than claiming a direct title launch. Keep this section with any public build.

## Development dependencies and exports

Development dependencies retain the licences in their npm packages. They are not copied into the TV JavaScript runtime.

`npm run export:public` excludes private fonts and includes this notice and the root MIT licence. Preserve the included font and icon licence texts. Review [public release preparation](docs/public-release.md) before publishing a repository or download.

## Home tile artwork

The Home tile carries the Home app's icon from Apple's public product page
(`https://www.apple.com/v/home-app/i/images/meta/home-app__fgegqj2rnt26_og.png`),
cropped to a square and reduced to a transparent mark at
`app/assets/icons/home.png`. Apple, Home and that icon are Apple Inc.
trademarks, used here only to identify the Home screen this launcher draws; they
are not covered by this project's MIT licence. A build that must not carry the
mark can remove that file and the two references to it in `app/main.js`.

## Artwork supplied by the device owner

`app/assets/backdrops/home-app.jpg`, `app/assets/backdrops/settings.jpg` and
`app/assets/icons/settings.png` were supplied by the owner of this installation
for personal use on their own set:

- Home app backdrop: Pinterest pin `f23ed32f9aa793df37caa24ff52d30f2`.
- Settings backdrop: accessibility.org.au Apple TV reference image (`appletv1.webp`).
- Settings mark: iDownloadBlog Apple TV Settings screenshot (`Apple-TV-Settings.png`).

They are not covered by this project's licence. They ship in this installation's
package only; the public build keeps CleanFrame's drawn marks.

## Ideas taken from APL Launcher for TizenOS

APL Launcher for TizenOS (https://github.com/Knikt/APL-Launcher-for-TizenOS, MIT,
Copyright (c) 2026 Knikt) is both a reference and, in part, the source of code in
this repository. The MIT licence text is retained at
`app/assets/avatars/APL-LAUNCHER-LICENSE.txt`.

Ported from that project and adapted to CleanFrame's own storage and transport
(`window.CleanFrameTV.exec`, in place of their bridge): its Settings and Control
Center screens (`app/apl-*.js`), their focus engine, icon set and alert/toast
chrome, and its household profiles panel (`app/apl-profiles.js`).

The 3D avatars in `app/assets/avatars/` are Microsoft Fluent Emoji
(https://github.com/microsoft/fluentui-emoji), MIT, as they are in that project.
They are covered by this project's MIT licence on the same terms.

The rest of that project was read as a reference for how a Tizen launcher reaches
the screen's own services. The following behaviours follow what it worked out:

- Resolving a Samsung app by the name the set lists it under when its known
  package id refuses the launch, rather than trusting one hard-coded id.
- Painting a folder face and its open pane with a blurred slice of the wallpaper
  beneath it (a prebuilt image, positioned like a lens) instead of a live blur,
  so the material costs nothing per frame.
