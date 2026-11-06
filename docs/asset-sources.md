# Asset sources

Reviewed on 20 October 2026. Each of the fifteen linked Unsplash photo pages displayed the listed author and “Free to use under the Unsplash License”. The bundled wallpapers, thumbnails and material fields derive from these photos. Keep these credits with redistributions and follow the [Unsplash License](https://unsplash.com/license).

| Wallpaper | Photographer | Source |
| --- | --- | --- |
| Misty coast | Ganapathy Kumar | [Photo page](https://unsplash.com/photos/n4VMQZIkgDg) |
| Quiet cove | Joshua Wordel | [Photo page](https://unsplash.com/photos/1L_5PT7EKzU) |
| Forest mist | Dejan Zakic | [Photo page](https://unsplash.com/photos/rr2EF3J5F2Y) |
| Mountain valley | Aniket Deole | [Photo page](https://unsplash.com/photos/M6XC789HLe8) |
| Desert stars | Mohammad Alizade | [Photo page](https://unsplash.com/photos/4wzRuAb-KWs) |
| Blue peaks | John Rodenn Castillo | [Photo page](https://unsplash.com/photos/rQqWOHZ96OM) |
| Bridge at dusk | Justin Wolff | [Photo page](https://unsplash.com/photos/pbp_Ww2cewA) |
| Sunlit ridges | Cristina Gottardi | [Photo page](https://unsplash.com/photos/wndpWTiDuT0) |
| Golden hour | Karthik Sreenivas | [Photo page](https://unsplash.com/photos/tmtkhWbgMu8) |
| Sunlit summits | Rudra Gupta | [Photo page](https://unsplash.com/photos/PuTSzJJ-qyU) |
| Gold Coast dusk | City of Gold Coast | [Photo page](https://unsplash.com/photos/YiaGblobOGI) |
| Sydney Harbour | Caleb | [Photo page](https://unsplash.com/photos/JmuyB_LibRo) |
| Amber hills | Chris Barbalis | [Photo page](https://unsplash.com/photos/vazZtmYFgFY) |
| Mint wave | MagicPattern | [Photo page](https://unsplash.com/photos/87PP9Zd7MNo) |
| Alpine glow | Cristina Gottardi | [Photo page](https://unsplash.com/photos/CSpjU6hYo_0) |

The background preparation and material rendering steps are described in [asset generation](assets.md). Full-size original photos and research studies are outside the public source.

## Bundled YouTube backdrop

The private build's YouTube splash is derived from the 3840 x 2160 frame published at [How-To Geek: Apple TV dashboard](https://static0.howtogeekimages.com/wordpress/wp-content/uploads/2024/05/apple_tv_dash.png) (image URL as published in May 2024). The mock-up's own dock, app tiles and clock/profile pill are cropped out, and the remaining artwork above the dock is centre-cropped to 1920 x 1080. No source pixels are invented and the YouTube mark is kept as published.

The source is a photograph of another company's splash screen, so the derived `youtube.jpg` stays in ignored `.local/` and is overlaid into the private package only. The public export keeps CleanFrame's original `app/assets/backdrops/youtube.svg` drawing. See [asset generation](assets.md) for the overlay.

## Private dock tiles

The private dock's 504 x 316 tiles are composed from official store artwork, all retrieved on 26 October 2026. The public export never includes them; it keeps the drawn marks in `app/main.js`.

| Tile | Source |
| --- | --- |
| Netflix, YouTube, Apple TV, Prime Video, JioHotstar, SonyLIV, Spotify, Apple Music, YouTube TV, YouTube Kids, Amazon Alexa | Apple App Store 512 px artwork, served from `is1-ssl.mzstatic.com` |
| Moonlight, Samsung TV Plus | Google Play listing artwork (`com.samsung.android.tvplus` for TV Plus), served from `play-lh.googleusercontent.com` |
| TizenTube | `standalone/icon.png` in [reisxd/TizenTube](https://github.com/reisxd/TizenTube) |
| Nuvio | CleanFrame's own `app/assets/icons/nuviotv.png` |
| Stremio, TV Internet | CleanFrame drawings |

These are third-party trademarks used to identify the services on a personal TV. They are not redistributed: `.local/icons-src/`, `.local/tiles/` and the catalogue generated from them stay ignored. Anyone publishing a build must replace them with their own licensed artwork or keep the drawn marks.

## Fonts and icons

Public fonts are Manrope, Geist and Newsreader under SIL OFL 1.1. Their licence texts are beside the assets; Geist and Newsreader source URLs and hashes are in `app/assets/fonts/SOURCES.json`.

Icon sources, exact revisions and adaptation notes are in `app/assets/icons/SOURCES.json` and `ADDITIONAL-SOURCES.json`. ABC and SBS use the MIT Custom Brand Icons source at revision `a53cabf49bf439023a8f33585af30d783bffe51b`; ABC is recoloured from `abc-australia.svg`, and SBS is the extracted feather contour from `sbs-chill.svg`. The Disney+ icon also uses that project under MIT. Other service icons use Simple Icons under CC0. Utility outlines are original CleanFrame drawings. See [third-party notices](../THIRD_PARTY_NOTICES.md) for the retained licence texts and trademark scope.

## Aerial screen saver footage

`app/assets/aerials/catalog.js` lists clips by theme. The footage is Apple's own
tvOS aerial series and is **not** bundled or redistributed in this repository:
each entry is a URL on `sylvan.apple.com` that the set streams directly, in the
same way the Apple TV fetches it. The catalogue holds only names and URLs, so a
public checkout carries no Apple media. A set with no route to those servers
falls back to the painted scenes in `app/aerial.js`, which are generated at
runtime and use no third-party artwork.

The names, captions and URLs are taken from the public aerial index at
`bzamayo.com/extras/apple-tv-screensavers.json`, which lists Apple's whole
gallery with the caption each clip shows and its 1080p H.264 rendition
(`_2K_AVC.mov`). `python scripts/build-aerial-catalog.py` regenerates
`catalog.js` from it and `--check` fails when the file is stale. 113 clips
across the four themes, every address verified to answer a range request.

Three formats were rejected before this one. Apple's own
`Aerials/2x/entries.json` offers HEVC only, and that is not a codec to hand a
television's web engine. The H.264 addresses the mirror lists under
`itunes-assets/` all answer 404. And every address on that host fails its TLS
handshake: the chain stops at "Apple Server Authentication CA" without the CA
that issued it and without a `caIssuers` pointer, so a browser or a set cannot
verify it and the request dies unread. The same files answer over plain HTTP,
which is what the catalogue uses.
