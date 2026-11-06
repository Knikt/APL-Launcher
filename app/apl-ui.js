/* ============================================================
   apl-ui.js — the small text and message layer the ported Settings app and
   Control Centre expect (APL.t, APL.toast, APL.alert).

   Settings and Control Centre are APL Launcher's own screens, carried over
   nearly unchanged; they call APL.t("...") for their text, APL.toast() for a
   confirmation and APL.alert() for a destructive question. CleanFrame already
   has its own message card, but these screens are modal and read their own
   layer, so this file provides it rather than rewriting every call.

   The text is English: the interface language of the ported screens is not
   wired to the rest of CleanFrame, which keeps its own wording.
   ============================================================ */
(function (global) {
  'use strict';

  var APL = global.APL = global.APL || {};

  /* ---------- text ----------
     t("Going to sleep in {n} min", { n: 5 }) — an unknown placeholder stays
     as written, so a missing value shows up instead of "undefined". */
  function t(text, vars) {
    var s = String(text).replace(/^[a-z]+\|/, '');
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
      });
    }
    return s;
  }
  APL.t = t;
  APL.lang = 'en';
  APL.locale = 'en-GB';

  /* ---------- where these screens are drawn ----------
     CleanFrame's stage is a 1920 x 1080 box scaled to fit the window, and it
     carries a transform. A fixed layer inside it is therefore positioned in the
     stage's own coordinates and scaled with it, which is what the ported
     screens need: at 1:1 over a scaled stage they were drawn larger than the
     app around them. */
  var layerEl = null;
  function layer() {
    if (!layerEl || !layerEl.parentNode) layerEl = document.getElementById('stage') || document.body;
    return layerEl;
  }
  APL.layer = layer;

  /* ---------- toast ----------
     One line at the bottom of the screen, replaced by the next one. `info`
     keeps it short: the screens use it for confirmations that carry no error. */
  var toastEl = null, toastTimer = 0;
  function toast(message, info) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'apl-toast';
      layer().appendChild(toastEl);
    }
    toastEl.textContent = String(message == null ? '' : message);
    toastEl.classList.toggle('is-info', !!info);
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, info ? 2200 : 3200);
  }
  APL.toast = toast;

  /* ---------- alert ----------
     A question with buttons, on its own nav: OK runs the button, Back cancels.
     Used for the destructive actions (reset a picture setting, forget a
     headphone). Without buttons it is a plain notice. */
  var alertRoot = null, alertNav = null, alertButtons = [], alertActions = [];

  function closeAlert() {
    if (!alertRoot) return;
    alertRoot.classList.remove('is-open');
    document.body.classList.remove('has-apl-alert');
    APL.popNav(alertNav);
    var r = alertRoot;
    alertRoot = null;
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 220);
  }

  function openAlert(opts) {
    opts = opts || {};
    if (alertRoot) closeAlert();
    var root = document.createElement('section');
    root.className = 'apl-alert';
    var card = document.createElement('div');
    card.className = 'apl-alert__card';
    var title = document.createElement('h2');
    title.className = 'apl-alert__title';
    title.textContent = String(opts.title || '');
    card.appendChild(title);
    if (opts.message) {
      var line = document.createElement('p');
      line.className = 'apl-alert__message';
      line.textContent = String(opts.message);
      card.appendChild(line);
    }
    var row = document.createElement('div');
    row.className = 'apl-alert__row';
    alertButtons = [];
    alertActions = [];
    (opts.buttons || [{ label: t('OK') }]).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'apl-alert__button' + (b.destructive ? ' is-destructive' : '');
      el.textContent = String(b.label || t('OK'));
      row.appendChild(el);
      alertButtons.push(el);
      alertActions.push(b);
    });
    card.appendChild(row);
    root.appendChild(card);
    layer().appendChild(root);
    document.body.classList.add('has-apl-alert');
    alertRoot = root;
    void root.offsetWidth;
    root.classList.add('is-open');

    alertNav = new APL.Nav({
      onSelect: function (i) {
        var b = alertActions[i];
        closeAlert();
        if (b && b.run) b.run();
      },
      onBack: closeAlert
    });
    alertNav.setTiles(alertButtons);
    alertNav.focus(Math.min(opts.focus || 0, alertButtons.length - 1));
    APL.pushNav(alertNav);
  }
  APL.alert = openAlert;
  APL.closeAlert = closeAlert;
})(window);
