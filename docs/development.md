# Development

## Browser preview

Start with Node.js 22+ and Python 3.10+, then `npm ci`. These are the supported development baselines; lower versions have not been checked. Install Chromium once with `npx playwright install chromium` for the optional browser tools. Linux hosts may also need Playwright's documented system dependencies (`npx playwright install --with-deps chromium`).

`npm run dev` starts http://localhost:4795/home/, bound to this computer only. `/home/` serves `app/`, the same source used in the signed widget. Arrow keys, Enter and Escape mirror remote navigation. Device controls report that they require the TV; no success is simulated.

`npm run dev:public` serves the same interface using only the bundled public fonts, even when paid Pangram files exist locally. For a contributor's fresh clone, use the README and `docs/for-agents.md`; the signing/device setup below describes the reference machine and needs adaptation for another owner.

All UI assets, public fonts and the fifteen wallpapers are bundled. This private build also includes the three locally installed Pangram families through an ignored build overlay; their binaries are not in the public source tree. Home Assistant connection details, rooms and entity IDs live in ignored `.local/ha.js`; the private package overlay injects that file, while public builds and previews use the safe `app/ha.js` stub with Home Assistant disabled. Glass materials and blurred panel backgrounds are rendered ahead of time; see app/assets/wallpapers/README.md.

## Runtime map and compatibility

- `app/index.html` loads the device adapter, Home Assistant client, Search, ambient status, gallery/font/palette catalogues, `assets/icons/metrics.js`, the assistant's `ai.js`/`assistant.js` and `main.js`, with `style.css`.
- `main.js` owns the List and Dock layouts, panel stack, focus, preferences and wallpaper timers, and the Search sheet's own keyboard, suggestions and poster grid. `device.js` owns installed-app discovery and Tizen calls, including the verified Prime Video GTI app-control payload and `search(ref, term, done)`, which hands a typed query to an app's own search screen. `search.js` owns Cinemeta and JustWatch querying; `status.js` owns the weather and region cache. Keep device details in the adapter.
- `assistant.js` owns the Ask sheet, its keypad and its mic modes. It captures keys on `window` before `main.js` while the sheet is open, and it widens the accepted mic keys from `tizen.tvinputdevice.getSupportedKeys()` at start. `window.CleanFrameAsk.hold()` and `.release()` expose the mic key's two halves for a browser check; Ctrl+Space stands in for the mic there. Releasing the mic key opens the keyboard rather than asking, and a recorded clip is transcribed into that same keyboard.
- `apl-*.js` are APL Launcher for TizenOS's own Settings app and Control Center, ported onto this app's Vetro client. `apl-icons.js` draws their line pictograms and the Settings icon, `apl-nav.js` is their remote focus engine and screen stack (loaded before `main.js`, listening on the document in the capture phase, so a press belongs to the ported screen while one is open and to the grid otherwise), `apl-ui.js` supplies `APL.t`, the toast and the alert, `apl-sys.js` reads and writes the screen (picture, Game Mode, the native Samsung settings, sound, network, sleep timer) through `window.CleanFrameTV.exec` instead of their own bridge service, `apl-settings-tree.js` lists the rows this app can back, and `apl-settings.js`/`apl-controlcenter.js` are their two screens, opened by the Settings tile and by the capsule's Control Centre tool (and by the remote's Play/Pause), and `apl-profiles.js` is their household-profiles panel: it keeps one saved launcher state per person and swaps the blob in `cleanframe.home.v1` when a profile is chosen, so each profile has its own Home order, folders, wallpaper and look. Profiles paint the avatar in the capsule (`#statusPillAvatar`) and in the Control Center header; their avatar art is in `app/assets/avatars/`. Their classes carry an `apl-` prefix and their blur is replaced by a colour wash; their CSS is the last section of `style.css`.
- The logical stage is 1920 x 1080, scaled uniformly to the viewport. Check at 1920 x 1080 and 1280 x 720. Glass geometry and cached materials must stay aligned.
- Preferences use localStorage key `cleanframe.home.v1`, with a fallback read from `cleanframe.shore.v1`. Legacy fields are `dock`, `wallpaper`, `mode`, `lastApp` and `theme`. The 0.6 migration preserves app order, wallpaper, rotation and selection. Legacy `list` becomes Dark / List / Type; `shore` and `grid` become Photo / Dock / Glass. Appearance axes are stored separately. A saved dynamic app keeps its real app ID and name; discovery refreshes the installed catalogue. Keep migration checks when changing this format.
- `window.ShoreQA.state()` and `.where()` expose state and focus for browser tests. `.search(query)` drives the Search sheet exactly as its own keyboard does, so a browser check can wait on the catalogue without a remote; `.searchInfo()` reports the focused key, suggestions and card count. `minuteMs` can shorten rotation intervals in an isolated browser test.

## Animation budget

The TV repaints far slower than a desktop browser, so the stage is kept to work the compositor can do. Three rules follow from measurements on the reference set and in the preview:

- Never transition `box-shadow`, `filter` or `backdrop-filter` on a large or numerous surface. A focus lift that animates a 70 px shadow repaints that blur on every frame, for every card in view. Paint the lifted shadow once on its own layer and fade it in instead; `.appletv-glow` is the worked example, cross-fading with the resting plate on `.appletv-tile::before`.
- Keep the stage untransformed at 1:1. `fit()` writes `transform: none` when the viewport is exactly 1920 x 1080, because a scaled layer is re-rasterised at the scaled size and costs a full-stage repaint for nothing.
- Promote deliberately. Each `will-change` is a permanent layer; the backdrop's two stage-sized images and the dock track earn theirs, seventeen idle glow layers would not.

`window.ShoreQA.nav()` drives the real key path, so a preview can time focus moves (`performance.now()` around a loop of `nav`) without a remote. That measures script only; paint cost has to be judged on the set.

The tested target is the Tizen 9.0 TV in [TV status](tv-status.md). The manifest's `required_version="6.5"` is a package declaration, not proof that Tizen 6.5 has been tested. The exact TV Chromium/WebKit engine version has not been recorded. Keep runtime JavaScript ES5-compatible and verify any new DOM/CSS API on the target before claiming support. `node --check` checks syntax for Node; it does not enforce ES5 or TV API availability.

Keep material rendering in the development tools. See [asset generation](assets.md) and [testing](testing.md).

## Local TV tools and signing

This Mac's setup lives under `.local/` and is excluded from Git:

- `tizen-sdk/`: official Tizen SDK command-line tools, embedded Java and SDB.
- `certificates/private/`: Samsung-issued author/distributor certificates, private keys, protected PKCS12 files and their generated password.
- `certificates/ca/`: CA certificates from Samsung's Certificate Extension.
- `device.json`: TV host address.

`npm run package` builds the widget from `app/`, configures the workspace-local SDK and signing profile, then signs it with the official SDK. It writes `dist/CleanFrame-unsigned.wgt` and `dist/CleanFrame.wgt`. `scripts/font_assets.py` adds only the six approved local Pangram files when complete pairs are available, plus their generated CSS/catalogue. It never copies private fonts into `app/`. Public checkouts use Manrope, Geist and Newsreader. The same overlay writes `assets/backdrops/catalog.js` and, when `.local/youtube-backdrop.jpg` exists, the private YouTube backdrop; it also writes `assets/tiles/catalog.js` and, when the matching files exist in `.local/tiles/`, the private dock tiles. See [asset generation](assets.md).

A build for a different television replaces one packaged file rather than the source: `app/profile.js` carries the wordmark shown on screen and whether Art Mode exists, and `write_widget_archive(..., extra=..., exclude=...)` lets a build overlay another `profile.js` (plus the boot wordmark in `index.html`) and leave files out of the archive. Nothing in `app/` changes, so the repository stays the reference Frame's build. The second set's package is installed with `python scripts/tv.py install --host <address> --widget dist/CleanFrame-MiniLED.wgt`.

`python .local/build_wgt.py --profile lite` writes `dist/CleanFrame-Lite.wgt` for a set whose chip is weaker than the reference Frame's. It is a **separate application**, not another copy of the Frame build: its own package and application id (`CfrmLite1.CleanFrameLite`), its own display name, and so its own entry in the installed-app list. Installing it can never replace or modify the Frame's app, and no native Home/startup assignment is read or written by it.

The Lite archive carries less because the set cannot afford it on the animation path: no screen-saver module or clip catalogue, no per-app poster module (the stage stays on the wallpaper, so there is no fetch, decode or poster cross-fade while the row scrolls), one wallpaper with its four material slices instead of fifteen walls and sixty, and no WebGL orb - the assistant's listening light is the flat CSS one there. `app/lite.js` is generated into that package only and sets `window.CleanFrameLite`, which is read by `main.js` (no saver loader, no Screen Saver row in Settings) and `assistant.js` (flat orb). The flag is undefined in the Frame build, so every one of those branches is dead code there. The lite package is about 2.9 MB against the Frame's 17 MB.

Install it with `python scripts/tv.py install --host <address> --widget dist/CleanFrame-Lite.wgt --app CfrmLite1.CleanFrameLite`; `--app` is required because the identity lives in the packaged manifest, not in `app/config.xml`.

`npm run export:public` is a separate offline, unsigned export. It always disables the proprietary overlay, includes the project/third-party notices and writes `dist/CleanFrame-public-unsigned.wgt`. It reads no signing credentials and contacts no TV. Use it for public build preparation; `npm run package` on this machine remains a personal build that can contain paid fonts. Asset release checks are listed in `docs/public-release.md`.

The SDK requires a terminal when it prompts for certificate passwords and whether to save them. The packaging script supplies the generated certificate password from the ignored private file and declines the optional password-saving prompts. It redacts that password from output. Login credentials are not required for routine packaging.

The initial custom XML-signature implementation was rejected by the TV. Use the official SDK packager for future builds; the installed test was signed with Tizen CLI 2.5.25.

## Another checkout or Mac

Install the official [Samsung TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) into `.local/tizen-sdk`, or copy this Mac's local tools when appropriate. To retain in-place app updates, securely transfer the existing author certificate and its password. Keep those credentials local.

For new certificates, use Samsung's [certificate setup](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html). The distributor certificate must include the target TV's DUID. A generic emulator certificate does not establish compatibility with this consumer TV.

Create `.local/device.json` with:

```json
{"host": "YOUR_TV_IP_ADDRESS"}
```

For developer access, connect the TV and Mac to the same network, enable Developer Mode in Apps → App Settings → 12345 and enter the Mac's local address. Fully restart the TV if the developer port remains closed.

## Install and launch

`npm run tv:install` uploads the signed widget with a unique build filename and calls Samsung's `vd_appinstall` command. It checks for `install completed` and confirms the app appears in the installed-app list. `sdb install` on this TV only uploaded the widget and did not install it.

`npm run tv:launch` opens the installed test. It does not change startup defaults. All device scripts use the app identity in `app/config.xml`; changing that identity would create a different application.

When the set runs Vetro, Developer Mode's *Host PC IP* is `127.0.0.1` and the developer port refuses every computer. `python scripts/tv.py install|launch` then does what the Vetro-based installers do: it copies the signed package to the screen in base64 chunks through Vetro's own HTTP interface (`http://<set>:8099`), checks the SHA-256 on the screen, installs it with the screen's `pkgcmd`, confirms the package id in `pkgcmd -l`, and launches with `/apps/launch`. Nothing about Developer Mode is changed, and the machine still needs no sdb. `--via sdb` or `--via vetro` forces one route.

## Sources

- [Samsung developer connection steps](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Samsung app-launch sample](https://github.com/SamsungDForum/LaunchApp)
- [Samsung remote input guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)

## Native Home and recovery

Native Home/startup was configured separately from the app installer. Physical Home from Netflix is confirmed. The one-shot helper runs as the SDK user. See scripts/native-home/README.md and docs/tv-status.md for the tested firmware and pending visual checks.

Query with `python3 scripts/native-home/run.py query`. Restore the saved pre-integration Home/startup values with `python3 scripts/native-home/run.py restore`. The private baseline is `.local/native-home/original.json`; preserve it and do not replace it with the applied state. The legacy `.local/native-home/run.py` command is also retained. Restore before uninstalling CleanFrame or changing its stable app identity.

To rebuild the one-shot helper with this Mac's private verified SDK:

```sh
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_CLI_HOME="$PWD/.local/native-home/cli" .local/native-home/dotnet-sdk/dotnet build scripts/native-home/Control.csproj -c Release --nologo -p:BaseIntermediateOutputPath="$PWD/.local/native-home/obj/" -o .local/native-home/out
```

The helper's output is not packaged inside the web app. Keep the original values, compiler, runtime output and all device diagnostics ignored.
