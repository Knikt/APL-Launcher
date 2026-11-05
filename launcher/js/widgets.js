/* ============================================================
   widgets.js — "Continue Watching", like on Apple TV.

   When an app is selected on the Home Screen, its cards take up the whole
   top of the screen over a blurred background, and the App Switcher shows them too:
     Last Channel           IPTV apps: Hot Player, AquaPlay
     Continue Watching      if one of the last two things watched
                            is an unfinished movie or series (and Stremio)

   Each app keeps its own history: it is read here, read-only
   (root command through Vetro). Nothing is asked of the IPTV provider.
     AquaPlay    keeps its channels' names and logos, and the names of movies:
                 picture from TMDB, with the title drawn on it; channel logo from tv-logos
     Stremio     keeps its recent library: picture and rating from the IMDb
                 ID. Only the useful fields are read, never the account or its key
     Hot Player  keeps only the episode and the progress, without the name of the
                 series or of the channel: a "Continue" card with the app's
                 artwork, no "Last Channel" card
   Netflix, Prime Video and YouTube leave nothing readable on the screen:
   no card for them. No backslashes in the commands: Vetro doubles them.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys;
    var AQUA = "AquaPlay02.AquaPlay", HOT = "6YLB5zo9te.HotIptv", STREMIO = "IkWsFHtOY9.Stremio";
    var HOME = "/opt/usr/home/owner/apps_rw/";
    var AQUA_STORE = HOME + "AquaPlay02/data/Local Storage/leveldb";
    var AQUA_BLOBS = HOME + "AquaPlay02/data/IndexedDB/file__0.indexeddb.blob";
    var HOT_DB = HOME + "6YLB5zo9te/data/databases/file__0/1";
    var STREMIO_STORE = HOME + "IkWsFHtOY9/data/Local Storage/leveldb";
    // The cards only change after an app was used, and coming back from it empties the cache
    var CACHE_MS = 10 * 60000, DONE_AT = 0.95;          // watched to 95%: it is finished
    var ART_KEY = "apl.wdg.art2";             // 2: pictures with the title drawn on them (liveshelf.js keyArt)
    var root = null, row = null, shownFor = null, shownApp = null, cache = {}, pending = {};

    /* ---------- names and pictures: kept on the screen, they don't change ---------- */
    var art = {};
    try { art = JSON.parse(global.localStorage.getItem(ART_KEY) || "{}") || {}; } catch (e) {}
    function saveArt(key, value) {
        var keys = Object.keys(art);
        if (keys.length > 60) art = {};
        art[key] = value;
        try { global.localStorage.setItem(ART_KEY, JSON.stringify(art)); } catch (e) {}
        return value;
    }

    /* The log read here can be empty for a moment, while the app tidies its storage: that is not an
       empty list, the cards already known stay. */
    function readable(output) {
        var text = String(output || "");
        if (!/[a-z]/i.test(text)) throw new Error("nothing to read");
        return text;
    }

    /* "FR | Dune (2024)" -> "Dune": IPTV providers' names carry their prefixes. */
    function cleanTitle(name) {
        return String(name || "").replace(/^\s*[A-Z0-9+]{2,6}\s*[|:\-]\s*/, "").replace(/\s*(\((19|20)[0-9]{2}\)|-\s*(19|20)[0-9]{2})\s*$/, "").trim();
    }
    /* The year that providers add to the name: "EN - Captive - 2026", "Dune (2024)". */
    function yearOf(name) {
        var m = /(?:\(|-\s*)((?:19|20)[0-9]{2})\)?\s*$/.exec(String(name || ""));
        return m ? m[1] : "";
    }
    function minutesLeft(position, duration) {
        return APL.t("{n} min left", { n: Math.max(1, Math.round((duration - position) / 60)) });
    }

    /* ---------- Hot Player ---------- */
    function hotCards() {
        var db = "/tmp/apl-hot.db";
        // A copy: the database stays with Hot Player. [current_time]: without brackets, SQLite reads it as the current time.
        return sys.exec("cp '" + HOT_DB + "' " + db + " 2>/dev/null; sqlite3 -separator '|' " + db + " \"select type,total_time,[current_time],title from WatchHistory order by date desc limit 2\"; rm -f " + db).then(function (r) {
            var rows = String(r.output || "").trim().split("\n").map(function (l) { return l.split("|"); }).filter(function (w) {
                var total = parseFloat(w[1]), at = parseFloat(w[2]);
                return w.length >= 4 && /^(series|movie|vod)$/.test(w[0]) && total > 0 && at / total < DONE_AT;
            });
            if (!rows[0]) return [];
            var w = rows[0], total = parseFloat(w[1]) / 1000, at = parseFloat(w[2]) / 1000;
            var app = ((APL.allApps && APL.allApps()) || []).filter(function (a) { return a.id === HOT; })[0] || {};
            return [{ kind: "video", label: APL.t("Continue Watching"), title: w[3] || app.name || "Hot Player", image: app.bg || app.tile || "", appArt: true,
                      progress: at / total, sub: minutesLeft(at, total) }];
        });
    }

    /* ---------- AquaPlay ---------- */
    /* The last channel is only kept as a code (x57072). The name and the logo are in its channel
       list, a file in its IndexedDB database that starts with "ch3:". One record per channel,
       saved by the JavaScript engine. Only the area around the record is read, as numbers:
       the rest of the file holds the subscription's addresses, and none of it leaves here. */
    function aquaLookup(key) {
        if (!/^[A-Za-z0-9_.:-]+$/.test(key)) return Promise.resolve(null);
        return sys.exec("for f in '" + AQUA_BLOBS + "'/*/*/*; do case $(head -c 64 \"$f\" | tr -d '[:cntrl:]') in *ch3:*) " +
                        "o=$(grep -a -b -o -m1 -E 'key\".{1,2}" + key + "\"' \"$f\" | head -1 | cut -d: -f1); " +
                        "if [ -n \"$o\" ]; then s=1; [ \"$o\" -gt 600 ] && s=$((o-600)); " +
                        "tail -c +$s \"$f\" 2>/dev/null | head -c 1100 | od -An -v -tu1; break; fi;; esac; done").then(function (r) {
            var b = String(r.output || "").trim().split(/\s+/).map(Number), info = readChannel(b, key);
            return info ? saveArt("aquach:" + key, info) : null;
        }, function () { return null; });
    }
    function asciiAt(b, at, text) {
        for (var i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
        return true;
    }
    /* A field of the record: its name, preceded by its length, then its value. */
    function fieldAt(b, at, name) { return b[at] === 34 && b[at + 1] === name.length && asciiAt(b, at + 2, name) ? at + 2 + name.length : -1; }
    function findField(b, name, from, step) {
        for (var i = from; i >= 0 && i < b.length; i += step) {
            var v = fieldAt(b, i, name);
            if (v !== -1) return v;
        }
        return -1;
    }
    /* A value: 34 for 8-bit, 99 for UTF-16 (sometimes after a padding byte), then the length. */
    function textAt(b, i) {
        if (i < 0) return "";
        while (b[i] === 0) i++;
        var tag = b[i++], len = 0, shift = 0, v, s = "", k;
        do { v = b[i++]; len |= (v & 127) << shift; shift += 7; } while (v & 128 && shift < 28);
        if (tag === 34) for (k = 0; k < len && i + k < b.length; k++) s += String.fromCharCode(b[i + k]);
        else if (tag === 99) for (k = 0; k + 1 < len && i + k + 1 < b.length; k += 2) s += String.fromCharCode(b[i + k] | (b[i + k + 1] << 8));
        return s;
    }
    function readChannel(b, key) {
        for (var i = 0; i < b.length; i++) {
            var v = fieldAt(b, i, "key");
            if (v === -1 || textAt(b, v) !== key) continue;
            var name = channelTitle(textAt(b, findField(b, "name", i, -1)));
            var logo = textAt(b, findField(b, "logo", v, 1));
            return name ? { name: name, logo: /^https?:[/][/]/.test(logo) ? logo : "" } : null;
        }
        return null;
    }
    /* "FR - M6 FHD ◉ [BK]" -> "M6": providers add the country, the quality and symbols. */
    function channelTitle(raw) {
        var s = String(raw || "").replace(/[^ -~\u00C0-\u017F]/g, " ").replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
            .replace(/^\s*([A-Z]{2,3}\s*[|:-]+\s*)+/, "")
            .replace(/\b(4K|8K|UHD|FHD|QHD|HD|SD|HEVC|H26[45]|1080[PI]?|720P|[0-9]{2}FPS|BACKUP|VIP|RAW)\b/gi, " ")
            .replace(/\s+/g, " ").replace(/[\s|:_-]+$/, "").trim();
        return s || String(raw || "").replace(/[^ -~\u00C0-\u017F]/g, " ").trim();
    }
    function aquaChannel(key) {
        var known = art["aquach:" + key];
        return (known ? Promise.resolve(known) : aquaLookup(key)).then(function (info) {
            var coded = /^x?[0-9]+$/.test(key);          // a bare code: never shown on screen
            var app = ((APL.allApps && APL.allApps()) || []).filter(function (a) { return a.id === AQUA; })[0] || {};
            var title = info ? info.name : coded ? (app.name || "AquaPlay") : channelName(key);
            var images = [];
            if (info || !coded) images.push(channelLogo(title));
            if (info && info.logo) images.push(info.logo);
            if (!info && coded && app.tile) images.push(app.tile);
            images = images.filter(Boolean);
            return { kind: "channel", label: APL.t("Last Channel"), title: title, image: images[0] || "", images: images };
        });
    }

    /* The last programme can be a series ("s57407") or a movie ("v1504070") rather than a
       channel. Their name is in AquaPlay's catalogue: JSON lists in its database, in UTF-16 when
       a name needs it, hence the pattern that allows a null byte between two letters. Only the name
       comes out, as numbers: movie records also hold the subscription's address. Measured: 0.7 s. */
    function aquaProgramName(key) {
        if (!/^[sv][0-9]+$/.test(key)) return Promise.resolve("");
        var loose = key.split("").concat('"').join(".?");
        return sys.exec("export LC_ALL=C; f=$(grep -a -l -m1 -E 'k.?e.?y.?\".?:.?\".?" + loose + "' '" + AQUA_BLOBS + "'/*/*/* 2>/dev/null | head -1); " +
                        "[ -n \"$f\" ] && tr -d '[:cntrl:]' < \"$f\" | grep -a -o -m1 '\"name\":\"[^\"]*\",\"skey\":\"[^\"]*\",\"key\":\"" + key + "\"' | " +
                        "cut -d'\"' -f4 | od -An -v -tu1").then(function (r) {
            // Latin-1 bytes: what is left of a UTF-16 name once the null bytes are removed
            var name = String(r.output || "").trim().split(/\s+/).map(Number).filter(function (n) { return n >= 32; })
                .map(function (n) { return String.fromCharCode(n); }).join("");
            return name ? saveArt("aquaname:" + key, name) : "";
        }, function () { return ""; });
    }
    /* Its card: the TMDB picture and the title, the progress if AquaPlay kept it. For a series,
       the episode in progress (season, number) and its progress, stored under the episode's code. */
    function aquaProgram(key, resume, episode) {
        var known = art["aquaname:" + key];
        return (known ? Promise.resolve(known) : aquaProgramName(key)).then(function (name) {
            var title = cleanTitle(name || (resume && resume.n) || ""), year = yearOf(name);
            if (!title) return null;
            var artKey = "aqua2:" + title + (year ? " " + year : "");
            var image = art[artKey] ? Promise.resolve(art[artKey]) : APL.live.searchArt(title, year).then(function (a) { return a ? saveArt(artKey, a) : null; });
            return image.then(function (a) {
                var sub = [a ? APL.live.noteOf(a) : "", episode ? "S" + episode.s + " E" + episode.n : "",
                           resume ? minutesLeft(resume.p / 1000, resume.d / 1000) : episode ? "" : key.charAt(0) === "s" ? APL.t("TV Show") : APL.t("content|Movie")].filter(Boolean).join(" · ");
                return { kind: "video", label: APL.t("Continue Watching"), title: title, image: a ? a.image : "", titled: !!(a && a.titled), logo: a ? a.logo || "" : "",
                         progress: resume ? resume.p / resume.d : undefined, sub: sub };
            });
        });
    }

    /* The other channel keys: type prefix, then TV id or shortened name, sometimes "~full name". */
    function channelName(key) {
        var k = String(key || "");
        var full = k.indexOf("~") !== -1 ? k.substr(k.indexOf("~") + 1) : k.replace(/^[^:]*:/, "");
        full = full.replace(/[._-]+/g, " ").replace(/ (fr|hd|fhd|uhd|sd|be|ch)$/i, "").trim();
        return full.length <= 4 ? full.toUpperCase() : full.charAt(0).toUpperCase() + full.substr(1);
    }
    /* The French logos from tv-logos (github.com/tv-logo/tv-logos), sharp and on a transparent background:
       the IPTV providers' ones are often small or blurry. Their names, compared without spaces, dashes or
       accents: "CNews", "BFMTV", "L'Équipe" or "Canal+" find theirs. */
    var TV_LOGOS = (
        "6ter ab1 ab3 abx action altice-studio animaux arte automoto-la-chaine b-smart bein-sports-1-french " +
        "bein-sports-2-french bein-sports-3-french bein-sports bet bfm-business bfm-grand-lille " +
        "bfm-grand-littoral bfm-lyon bfm-paris bfm-tv boing boomerang c-news c-news-prime c-star c8 canal-j " +
        "canal-plus-box-office canal-plus-cinemas canal-plus-docs canal-plus-foot canal-plus-formula1 canal-plus " +
        "canal-plus-grand-ecran canal-plus-hello canal-plus-kids canal-plus-ligue1 canal-plus-magic " +
        "canal-plus-moto-gp canal-plus-outremer canal-plus-premier-league canal-plus-series canal-plus-sport-360 " +
        "canal-plus-sport canal-plus-story canal-plus-top-14-rugby cartoon-network chasse-et-peche " +
        "cine-plus-classic cine-plus-emotion cine-plus-family cine-plus-festival cine-plus-frisson cine-plus-ocs " +
        "cine-plus-premier comedie-plus crime-district culturebox disney-channel disney-jr dreamsee " +
        "drive-in-movie-channel equidia europe-2-pop-tv europe1-tv eurosport-1 eurosport-2 france-2 france-24 " +
        "france-3 france-4 france-5 franceinfo game-one golf-plus gulli histoire-tv infosport-plus j-one kto " +
        "la-chaine-meteo lci lcp lequipe ligue-1plus-10 ligue-1plus-2 ligue-1plus-3 ligue-1plus-4 ligue-1plus-5 " +
        "ligue-1plus-6 ligue-1plus-7 ligue-1plus-8 ligue-1plus-9 ligue-1plus m6 m6-music mangas mcm mcm-pop " +
        "mcm-top melody mezzo mezzo-live mgg-tv mon-nickelodeon-junior motorvision-plus motorvision-tv " +
        "multisports-1 multisports-2 multisports-3 multisports-4 multisports-5 multisports-6 multisports " +
        "nickelodeon nickelodeon-junior nickelodeon-plus nickelodeon-teen nolife non-stop-people novelas-tv " +
        "novo19 nrj-12 nrj-hits ocs-choc ocs-city ocs ocs-geants ocs-max ocs-pulp ol-tv olympia-tv one-tv " +
        "paramount-channel-decale paramount-channel paris-premiere pitchoun-tv piwi-plus planete-plus-aventure " +
        "planete-plus-crime planete-plus polar-plus public-senat rfm-tv rmc-decouverte rmc-life rmc-sport-1 " +
        "rmc-sport-2 rmc-sport-3 rmc-sport-4 rmc-sport-access-1 rmc-sport-access-2 rmc-sport-access-3 rmc-sport " +
        "rmc-sport-live-10 rmc-sport-live-11 rmc-sport-live-12 rmc-sport-live-13 rmc-sport-live-14 " +
        "rmc-sport-live-15 rmc-sport-live-16 rmc-sport-live-5 rmc-sport-live-6 rmc-sport-live-7 rmc-sport-live-8 " +
        "rmc-sport-live-9 rmc-sport-news rmc-story rt-france rtl9 science-and-vie-tv seasons serie-club " +
        "sport-en-france stingray-brava stingray-djazz t18 tcm-cinema teletoon-plus-1 teletoon-plus teva tf1 " +
        "tf1-plus tf1-series-films tfx tiji tlc tmc tmc-plus toute-lhistoire trace-caribbean trace-latina " +
        "trace-sport-stars trace-urban trek tv-breizh tv5-monde ultra-nature ushuaia-tv w9 warner-tv " +
        "warner-tv-next ").split(" ");
    var TV_LOGO_URL = "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/";
    function compact(name) {
        return String(name || "").toLowerCase().replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e").replace(/[îï]/g, "i")
            .replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/ç/g, "c").replace(/\+/g, "plus").replace(/&/g, "and")
            .replace(/[^a-z0-9]/g, "");
    }
    var logoIndex = null;
    function channelLogo(name) {
        if (!logoIndex) {
            logoIndex = {};
            TV_LOGOS.forEach(function (slug) {
                if (!slug) return;
                logoIndex[compact(slug)] = slug;
                logoIndex[compact(slug.replace(/-french$/, ""))] = logoIndex[compact(slug.replace(/-french$/, ""))] || slug;
            });
        }
        var slug = logoIndex[compact(name)];
        return slug ? TV_LOGO_URL + slug + "-fr.png" : "";
    }

    /* LevelDB's .log file keeps the writes one after another: the last one is the right one. Values
       are 8-bit or UTF-16 depending on the text: the zeros are removed. */
    function aquaCards() {
        var read = "cat '" + AQUA_STORE + "'/*.log 2>/dev/null | tr -d '[:cntrl:]'";
        return sys.exec(read + " | grep -a -o '\"lastChannel\":[{][^}]*[}]' | tail -1; echo ===; " +
                        read + " | grep -a -o '\"recent\":[{][^}]*[}]' | tail -1; echo ===; " +
                        read + " | grep -a -o '\"resume\":[{].*\"subtitles\"' | tail -1 | tail -c 40000").then(function (r) {
            return parseAqua(readable(r.output));
        });
    }
    function parseAqua(text) {
        var parts = text.split("==="), work = [];
        var last = /"lastChannel":[{]"[^"]*":"([^"]+)"/.exec(parts[0] || "");
        var program = last && /^[sv][0-9]+$/.test(last[1]) ? last[1] : "";
        if (last && !program) work.push(aquaChannel(last[1]));
        // Only if it is one of the last two things watched
        var recent = /"recent":[{]"[^"]*":\[([^\]]*)\]/.exec(parts[1] || "");
        var lastTwo = recent ? recent[1].split(",").slice(0, 2).map(function (s) { return s.replace(/"/g, ""); }) : null;
        // Resume points of movies and episodes ("e" + number), each under its own code, in milliseconds.
        // AquaPlay writes them every 10 s after the first minute, and clears them at the end (the app's js/resume.js).
        var resumes = {}, best = null, re = /"([^"]+)":[{]"p":([0-9]+),"d":([0-9]+),"t":([0-9]+),"n":"([^"]*)"[}]/g, m;
        while ((m = re.exec(parts[2] || ""))) {
            var d = parseInt(m[3], 10), p = parseInt(m[2], 10), t = parseInt(m[4], 10);
            if (!(d > 0 && p / d < DONE_AT)) continue;
            resumes[m[1]] = { p: p, d: d, t: t, n: m[5] };
            if (m[5] && (!lastTwo || lastTwo.indexOf(m[1]) !== -1) && (!best || t > best.t)) best = resumes[m[1]];
        }
        // For a series, the episode in progress: "seriesNext", from the series to the episode, its season and its number
        var episodes = {}, next = /"(s[0-9]+)":[{]"e":"([^"]+)","s":([0-9]+),"n":([0-9]+)/g;
        var tail = (parts[2] || "").split('"seriesNext"')[1] || "";
        while ((m = next.exec(tail))) episodes[m[1]] = { e: m[2], s: m[3], n: m[4] };
        if (program) {
            var episode = episodes[program] || null;
            var resume = program.charAt(0) === "v" ? resumes[program] : episode ? resumes[episode.e] || resumes["e" + episode.e] : null;
            work.push(aquaProgram(program, resume || null, episode));
        }
        else if (best) {
            var title = cleanTitle(best.n), key = "aqua2:" + title;
            var image = art[key] ? Promise.resolve(art[key]) : APL.live.searchArt(title).then(function (a) { return a ? saveArt(key, a) : null; });
            work.push(image.then(function (a) {
                var sub = [a ? APL.live.noteOf(a) : "", minutesLeft(best.p / 1000, best.d / 1000)].filter(Boolean).join(" · ");
                return { kind: "video", label: APL.t("Continue Watching"), title: title, image: a ? a.image : "", titled: !!(a && a.titled), logo: a ? a.logo || "" : "",
                         progress: best.p / best.d, sub: sub };
            }));
        }
        return Promise.all(work).then(function (cards) { return cards.filter(Boolean); });
    }

    /* ---------- Stremio ---------- */
    /* The last write of "library_recent", only the fields listed here. Its profile, right next
       to it, holds the account and its key: they never leave this file. */
    var STREMIO_FIELDS = ['"_id":"[^"]+"', '"name":"[^"]*"', '"type":"[a-z]+"', '"poster":"[^"]*"', '"removed":[a-z]+', '"temp":[a-z]+',
                          '"lastWatched":"[^"]*"', '"timeOffset":[0-9]+', '"duration":[0-9]+', '"video_id":"[^"]*"'].join("|");
    function stremioCards() {
        return sys.exec("export LC_ALL=C; cat '" + STREMIO_STORE + "'/*.log 2>/dev/null | tr -d '[:cntrl:]' | grep -a 'library_recent' | sed -E 's/.*_file:..library_recent//' | " +
                        "grep -a -o -E '" + STREMIO_FIELDS + "' | head -c 120000").then(function (r) {
            return Promise.all(stremioRecent(readable(r.output)).slice(0, 2).map(stremioCard));
        });
    }
    /* A record starts at its "_id". Like Stremio: partly watched, not removed, most recent first. */
    function stremioRecent(text) {
        var byId = {}, cur = null;
        text.split("\n").forEach(function (line) {
            var m = /^"([A-Za-z_]+)":"?(.*?)"?$/.exec(line.trim());
            if (!m) return;
            if (m[1] === "_id") { cur = byId[m[2]] = { id: m[2] }; return; }     // the most recent record replaces the older one
            if (cur && !(m[1] in cur)) cur[m[1]] = m[2];
        });
        return Object.keys(byId).map(function (id) { return byId[id]; }).filter(function (i) {
            var at = parseInt(i.timeOffset, 10) || 0, total = parseInt(i.duration, 10) || 0;
            return i.type !== "other" && (i.removed !== "true" || i.temp === "true") && at > 0 && (!total || at / total < DONE_AT);
        }).sort(function (a, b) { return String(b.lastWatched).localeCompare(String(a.lastWatched)); });
    }
    function stremioCard(item) {
        var key = "stremio:" + item.id;
        var found = art[key] ? Promise.resolve(art[key]) : APL.live.findImdb(item.id).then(function (a) { return a ? saveArt(key, a) : null; });
        return found.then(function (a) {
            var at = parseInt(item.timeOffset, 10) / 1000, total = (parseInt(item.duration, 10) || 0) / 1000;
            var episode = /:([0-9]+):([0-9]+)$/.exec(item.video_id || "");
            var sub = [a ? APL.live.noteOf(a) : "", episode ? "S" + episode[1] + " E" + episode[2] : "", total ? minutesLeft(at, total) : ""].filter(Boolean).join(" · ");
            return { kind: "video", label: APL.t("Continue Watching"), title: a ? a.title : item.name, image: a ? a.image : (item.poster || ""),
                     titled: !!(a && a.titled), logo: a ? a.logo || "" : "", progress: total ? at / total : undefined, sub: sub };
        });
    }

    /* ---------- cards ---------- */
    var READERS = {};
    READERS[AQUA] = aquaCards;
    READERS[HOT] = hotCards;
    READERS[STREMIO] = stremioCards;

    /* The cards show at once, in their last known version. Reading the data takes only
       10 to 30 ms, but goes through the relay (bridge/service.js): stopped after 15 min without requests,
       it takes several seconds to start again (up to 4.9 s measured). So the reading happens on the side. */
    var KNOWN_KEY = "apl.wdg.cards";
    var known = {};
    try { known = JSON.parse(global.localStorage.getItem(KNOWN_KEY) || "{}") || {}; } catch (e) {}

    /* Without the pictures made by genart.js: they are too heavy to be kept twice. */
    function light(c) {
        var copy = {}, k;
        for (k in c) copy[k] = c[k];
        if (/^data:/.test(copy.image || "")) copy.image = "";
        if (copy.images) copy.images = copy.images.filter(function (u) { return !/^data:/.test(u); });
        return copy;
    }
    function remember(id, cards) {
        known[id] = cards.map(light);
        try { global.localStorage.setItem(KNOWN_KEY, JSON.stringify(known)); } catch (e) {}
    }
    function lastKnown(id) {
        if (!known[id]) return null;
        var app = ((APL.allApps && APL.allApps()) || []).filter(function (a) { return a.id === id; })[0] || {};
        return known[id].map(function (c) {
            if (!c.appArt || c.image) return c;
            var copy = light(c);
            copy.image = app.bg || app.tile || "";
            return copy;
        });
    }

    /* null if reading failed: what is on screen then stays. */
    function readCards(id) {
        var c = cache[id];
        if (c && Date.now() - c.at < CACHE_MS) return Promise.resolve(c.cards);
        if (pending[id]) return pending[id];
        pending[id] = READERS[id]().then(function (cards) {
            cache[id] = { cards: cards, at: Date.now() };
            delete pending[id];
            remember(id, cards);
            return cards;
        }, function () { delete pending[id]; return null; });
        return pending[id];
    }

    function cardsFor(id) {
        if (!READERS[id] || sys.PREVIEW) return Promise.resolve([]);
        var read = readCards(id), last = lastKnown(id);
        return last ? Promise.resolve(last) : read.then(function (cards) { return cards || []; });
    }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function cardEl(c) {
        var card = el("div", "wdg__card wdg__card--" + c.kind);
        var pic = el("div", "wdg__pic");
        // While waiting for the picture, or if none comes: the channel's name, the icon for a video
        if (c.kind === "channel") pic.appendChild(el("div", "wdg__mark", c.title));
        else pic.innerHTML = APL.icon("photo", 96, 1.4);
        card.appendChild(pic);
        var images = c.images || (c.image ? [c.image] : []);
        (function next(i) {
            if (i >= images.length) return;
            var probe = new global.Image();
            probe.onload = function () {
                pic.innerHTML = "";
                pic.style.backgroundImage = "url('" + images[i].replace(/'/g, "%27") + "')";
                // The title is already on the picture: it isn't written a second time
                if (c.titled && images[i] === c.image) card.classList.add("is-titled");
            };
            probe.onerror = function () { next(i + 1); };
            probe.src = images[i];
        })(0);
        if (c.logo) {
            var logo = el("img", "wdg__logo");
            logo.onload = function () { card.classList.add("is-titled"); };
            logo.onerror = function () { if (logo.parentNode) logo.parentNode.removeChild(logo); };
            logo.src = c.logo;
            card.appendChild(logo);
        }
        var txt = el("div", "wdg__txt");
        txt.appendChild(el("div", "wdg__label", c.label));   // in the App Switcher; on the Home Screen, the heading is above
        txt.appendChild(el("div", "wdg__title", c.title));
        if (c.sub) txt.appendChild(el("div", "wdg__sub", c.sub));
        card.appendChild(txt);
        if (c.progress !== undefined) {
            var bar = el("div", "wdg__bar"), fill = el("i", "");
            fill.style.width = Math.round(c.progress * 100) + "%";
            bar.appendChild(fill);
            card.appendChild(bar);
        }
        return card;
    }

    /* Blurred background, like on tvOS: the picture is drawn once into a tiny canvas that the screen
       stretches. No blur is recomputed while navigating. */
    var blur = null, blurToken = 0;
    function paintBlur(src, soft) {
        var token = ++blurToken;
        blur.style.opacity = "0";
        // One wallpaper for every app (Settings › Appearance › Top Shelf › Otherwise): the cards sit on it, unblurred
        if (!src || sys.pref("shelfArt") === "all") return;
        var img = new global.Image();
        img.onload = function () {
            if (token !== blurToken) return;
            var ctx = blur.getContext("2d"), w = blur.width, h = blur.height, m = 14;
            ctx.clearRect(0, 0, w, h);
            if ("filter" in ctx) ctx.filter = "blur(" + (soft ? 16 : 5) + "px) saturate(150%) brightness(0.85)";
            var r = Math.max((w + 2 * m) / img.naturalWidth, (h + 2 * m) / img.naturalHeight);
            var dw = img.naturalWidth * r, dh = img.naturalHeight * r;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
            blur.style.opacity = "1";
        };
        img.src = src;
    }

    function build() {
        root = el("div", "wdg");
        var back = el("div", "wdg__bg");
        blur = document.createElement("canvas");
        blur.className = "wdg__blur";
        blur.width = 192; blur.height = 108;
        back.appendChild(blur);
        row = el("div", "wdg__row");
        root.appendChild(back);
        root.appendChild(row);
        // Below the clock and the dock, above the Top Shelf picture and its gradient
        var scrim = document.querySelector(".scrim");
        scrim.parentNode.insertBefore(root, scrim.nextSibling);
    }

    function addCard(c) {
        var item = el("div", "wdg__item");
        item.appendChild(el("div", "wdg__heading", c.label));
        item.appendChild(cardEl(c));
        row.appendChild(item);
    }

    /* Next to the app's cards: a movie or series of the moment, with its rating. A different one each
       time you come back from an app: few movie apps have a place in the dock, so these ratings would
       not be seen otherwise. */
    var trendN = 0;
    function trendCard() {
        if (!APL.live || !APL.live.keys().tmdb || !APL.live.hasSource({ live: "trending" })) return Promise.resolve(null);
        return APL.live.itemsNow({ live: "trending" }).then(function (items) {
            var rated = (items || []).filter(function (i) { return i.rating && i.card; });
            if (!rated.length) return null;
            var i = rated[trendN % rated.length];
            return { kind: "video", label: APL.t("Popular This Week"), title: i.title, image: i.card, sub: APL.live.metaOf(i) };
        }).catch(function () { return null; });
    }

    function render(cards) {
        row.innerHTML = "";
        cards.forEach(addCard);
        var video = cards.filter(function (c) { return c.kind === "video" && c.image; })[0];
        // A blurred logo shows nothing: for a channel, the colours of the app's background
        paintBlur(video ? video.image : (shownApp && shownApp.bg) || (cards[0] && cards[0].image), !video);
        setShown(cards.length > 0);
    }

    /* On the Home Screen: the cards of the selected app, and of it alone. We wait for the focus to
       settle: while moving along the dock, nothing is read or drawn. Coming up from the grid, the
       Home Screen slides for 200 ms and its blurred background goes away: the cards wait for the
       end of it. The reading runs a command on the screen: after the cards already known, never
       during an animation. */
    var SETTLE_MS = 140, FROM_GRID_MS = 320, READ_LATER_MS = 900;
    var showTimer = null, readTimer = null, painted = "";
    function show(app, fromGrid) {
        var id = app && app.id, same = id === shownFor;
        shownFor = id;
        shownApp = app;
        if (!root) build();
        clearTimeout(showTimer);
        clearTimeout(readTimer);
        if (!same) setShown(false);
        if (!READERS[id] || sys.PREVIEW) return;
        showTimer = setTimeout(function () {
            var last = lastKnown(id);
            if (last) paint(id, last);
            readTimer = setTimeout(function () {
                readCards(id).then(function (cards) { if (cards && shownFor === id) paint(id, cards); });
            }, last ? READ_LATER_MS : 0);
        }, fromGrid ? FROM_GRID_MS : SETTLE_MS);
    }
    /* Same cards as on screen: nothing is redrawn. While on the cards, nothing moves under the focus. */
    function paint(id, cards) {
        var text = id + JSON.stringify(cards.map(light));
        if (text === painted) { setShown(cards.length > 0); return; }
        if (focused) return;
        painted = text;
        render(cards);
        // No card: the Top Shelf, with its movie and its rating. Two cards: the row is full.
        if (cards.length !== 1) return;
        trendCard().then(function (c) {
            if (!c || painted !== text || document.hidden) return;
            addCard(c);
            // The background follows the movie, unless the app has its own movie picture to show
            if (!cards.some(function (x) { return x.kind === "video" && x.image && !x.appArt; })) paintBlur(c.image);
        });
    }
    function setShown(on) {
        root.classList.toggle("is-on", on);
        document.body.classList.toggle("has-wdg", on);      // instead of the Top Shelf and its hint
    }

    /* Back from an app: what was just watched counts right away. */
    document.addEventListener("visibilitychange", function () {
        if (document.hidden || !READERS[shownFor]) return;
        delete cache[shownFor];
        trendN++;
        painted = "";
        show(shownApp);
    });

    /* ▲ from the dock: up onto the cards. OK resumes the app, ▼ or Back go back down. */
    var nav = null, focused = false;
    function focusCards() {
        var tiles = root && root.classList.contains("is-on") ? Array.prototype.slice.call(root.querySelectorAll(".wdg__card")) : [];
        if (!tiles.length) return false;
        if (!nav) {
            nav = new APL.Nav({
                onSelect: function () { var a = shownApp; leaveCards(); if (a) APL.openApp(a); },
                onBack: leaveCards,
                onEdge: function (dir) { if (dir === "down") leaveCards(); }
            });
        }
        nav.setTiles(tiles);
        nav.focus(0);
        APL.pushNav(nav);
        document.body.classList.add("wdg-focus");
        focused = true;
        return true;
    }
    function leaveCards() {
        if (!focused) return false;
        focused = false;
        var c = nav.current();
        if (c) c.classList.remove("is-focused");
        APL.popNav(nav);
        document.body.classList.remove("wdg-focus");
        return true;
    }

    APL.widgets = {
        show: show, cardsFor: cardsFor, cardEl: cardEl, focusCards: focusCards, leaveCards: leaveCards,
        isShowing: function () { return !!root && root.classList.contains("is-on"); }
    };
})(window);
