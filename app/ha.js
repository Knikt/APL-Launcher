/* CleanFrame Home Assistant public stub.
   The real personal client (host, token, rooms and entity IDs) is injected
   from ignored .local/ha.js only when building a private install. */
(function (root) {
  'use strict';

  var state = {};

  root.CleanFrameHA = {
    enabled: false,
    /* A private build points this at its own dashboard; without one there is
       no Home tile in the drawer at all. */
    dashboard: '',
    ROOMS: [],
    SCENES: [],
    getState: function (entityId) { return state[entityId] || null; },
    getAllStates: function () { return state; },
    isOnline: function () { return false; },
    toggleEntity: function () {},
    adjustClimateTemp: function () {},
    increaseFanSpeed: function () {},
    decreaseFanSpeed: function () {},
    adjustFanSpeed: function () {},
    setFanSpeed: function () {},
    adjustVolume: function () {},
    setVolume: function () {},
    setBrightness: function () {},
    brightnessPct: function () { return 0; },
    activateScene: function () {},
    turnOnEntity: function () {},
    turnOffEntity: function () {},
    callService: function () {},
    onMovieLaunched: function () {},
    refresh: function () {},
    subscribe: function (listener) { return function () {}; },
    setPanelActive: function () {},
    /* Opens the TV's own Settings screen through Home Assistant in a private
       build; the public stub does nothing, like every other request here. */
    tvSettings: function () {},
    tvOff: function () {},
    tvVolume: function () { return null; },
    tvSetVolume: function () {}
  };
})(window);
