/* ============================================================
   i18n.js — interface language.

   The launcher is written in English. Other languages come from a
   table keyed by the English text: js/lang-fr.js for French,
   js/lang-ms.js for Malay, js/lang-pl.js for Polish, js/lang-tr.js for Turkish, js/lang-pt.js for Brazilian Portuguese.
     APL.t("Settings")                          -> "Réglages" in French
     APL.t("Version {v} available", { v: "2" }) -> placeholders
   Text without a translation stays in English.
     APL.t("content|Movie")                     -> "Movie", "Film" in French, "Filem" in Malay
   A "context|" prefix tells apart two meanings of the same English
   word; it is never shown.

   The language follows the screen's (a French screen gets French,
   a Malay screen gets Malay, a Polish screen gets Polish),
   unless Settings › General › Language picks one. It is fixed when the
   launcher starts: changing it reloads the launcher.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL = global.APL || {};
    var TABLES = { fr: global.APL_LANG_FR || {}, ms: global.APL_LANG_MS || {}, pl: global.APL_LANG_PL || {}, tr: global.APL_LANG_TR || {}, pt: global.APL_LANG_PT || {} };

    /* The choice saved in Settings (screen-wide, not per profile): "auto", "en", "fr", "ms", "pl", "tr" or "pt". */
    function saved() {
        try { return (JSON.parse(global.localStorage.getItem("apl.prefs") || "null") || {}).language; } catch (e) { return null; }
    }
    function screenLanguage() {
        var l = String((global.navigator && (global.navigator.language || global.navigator.userLanguage)) || "en").toLowerCase();
        if (l.indexOf("fr") === 0) return "fr";
        if (l.indexOf("ms") === 0) return "ms";               // not "ml": that is Malayalam
        if (l.indexOf("pl") === 0) return "pl";
        if (l.indexOf("tr") === 0) return "tr";
        if (l.indexOf("pt") === 0) return "pt";
        return "en";
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
    APL.lang = lang;                                // "en", "fr", "ms", "pl", "tr" or "pt"
    APL.locale = lang === "fr" ? "fr-FR" : lang === "ms" ? "ms-MY" : lang === "pl" ? "pl-PL" : lang === "tr" ? "tr-TR" : lang === "pt" ? "pt-BR" : "en-US"; // for dates, sorting and TMDB
    /* The language of the films' descriptions, logos and trailers (TMDB): the screen's own, even where the interface
       has no translation in it (an Italian screen: Italian summaries, under English menus; #56). A language picked
       in Settings wins. */
    (function () {
        var nav = String((global.navigator && (global.navigator.language || global.navigator.userLanguage)) || "").replace("_", "-");
        var m = /^([a-z]{2})(?:-([a-z]{2}))?/i.exec(nav);
        if ((choice && choice !== "auto") || !m) { APL.contentLocale = APL.locale; APL.contentLang = lang; return; }
        var two = m[1].toLowerCase();
        APL.contentLang = two;
        APL.contentLocale = two + "-" + (m[2] ? m[2].toUpperCase() : two === "en" ? "US" : two.toUpperCase());
    })();
    try { document.documentElement.lang = lang; } catch (e) {}
})(window);
