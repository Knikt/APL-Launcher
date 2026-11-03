# Apps2Samsung catalog entry

`Knikt__APL-Launcher-for-TizenOS.json` is the entry for [Apps2Samsung/tizen-community-packages](https://github.com/Apps2Samsung/tizen-community-packages) (copy it to `packages/` there in a PR; schema: `packages.schema.json` in that repo).

It points at the `apl-launcher-v<version>.wgt` asset that `.github/workflows/setup.yml` attaches to every `v*` release (built by `tools/make-package.sh`). If you rename that file, update `match` here and in the catalog.

`user_settings` writes the optional API keys into `js/keys.local.js` before Apps2Samsung re-signs the package. The `find` strings are the `tmdb: "",` lines of `launcher/js/keys.example.js`, which the package ships as `keys.local.js`: if you change those lines, change the entry too (`make-package.sh` fails when they are missing).

The package holds the launcher only. APL Overlay (Home twice / held, Control Center over videos, Alexa) is a separate native package installed by APL Launcher Setup.
