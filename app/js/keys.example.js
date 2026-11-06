/* ============================================================
   keys.example.js — TEMPLATE. APL Launcher Setup creates keys.local.js from
   your answers. keys.local.js is never uploaded to GitHub (.gitignore):
   it stays on your PC (copy in %APPDATA%\APL-Launcher) and in the
   package installed on your screen.

   tmdb     Live Top Shelf: trending films and series per service
            themoviedb.org › Settings › API › API Key (v3)
   youtube  Trending videos in TizenTube's Top Shelf (optional)
            console.cloud.google.com › YouTube Data API v3 › Credentials
   fanart   Textless HD backgrounds (optional)
            fanart.tv › your profile › API Key
   region   Country of the services and stores read for the artwork,
            the Top Shelf and the searches (2 letters, e.g. "IN", "US").
            Leave it out to follow the screen's own country; Settings ›
            Apps › Country for the Top Shelf does the same on the screen.
   webApps  Websites shown as apps, opened in Samsung Internet
            e.g. [{ name: "My site", url: "https://example.com/" }]
   ============================================================ */
window.APL_KEYS = {
    tmdb: "",
    youtube: "",
    fanart: "",
    region: "",
    webApps: []
};
