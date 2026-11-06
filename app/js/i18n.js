/* ============================================================
   i18n.js — interface language.

   The launcher is written in English. Other languages come from a
   table keyed by the English text: js/lang-fr.js for French.
     APL.t("Settings")                          -> "Réglages" in French
     APL.t("Version {v} available", { v: "2" }) -> placeholders
   Text without a translation stays in English.
     APL.t("content|Movie")                     -> "Movie", "Film" in French
   A "context|" prefix tells apart two meanings of the same English
   word; it is never shown.

   The language follows the screen's (a French screen gets French),
   unless Settings › General › Language picks one. It is fixed when the
   launcher starts: changing it reloads the launcher.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL = global.APL || {};
    var TABLES = { fr: global.APL_LANG_FR || {} };

    /* The choice saved in Settings (screen-wide, not per profile): "auto", "en" or "fr". */
    function saved() {
        try { return (JSON.parse(global.localStorage.getItem("apl.prefs") || "null") || {}).language; } catch (e) { return null; }
    }
    function screenLanguage() {
        var l = String((global.navigator && (global.navigator.language || global.navigator.userLanguage)) || "en").toLowerCase();
        return l.indexOf("fr") === 0 ? "fr" : "en";
    }

    var choice = saved();
    var lang = choice === "en" || TABLES[choice] ? choice : screenLanguage();
    var table = TABLES[lang] || {};

    function t(text, vars) {
        var s = Object.prototype.hasOwnProperty.call(table, text) ? table[text] : String(text).replace(/^[a-z]+\|/, "");
        if (vars) {
            s = String(s).replace(/\{(\w+)\}/g, function (m, k) {
                return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
            });
        }
        return s;
    }

    APL.t = t;
    APL.lang = lang;                                // "en" or "fr"
    APL.locale = lang === "fr" ? "fr-FR" : "en-US"; // for dates, sorting and TMDB
    try { document.documentElement.lang = lang; } catch (e) {}
})(window);
