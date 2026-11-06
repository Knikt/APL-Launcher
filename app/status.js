/* CleanFrame ambient status: current weather for the quiet Home header.
   Public, key-free services only. Location is approximate (network IP) and is
   cached locally; no device identifier is sent. Tizen 6.5 / ES5. */
(function () {
  'use strict';

  var WEATHER_KEY = 'cleanframe.weather.v1';
  var LOCATION_KEY = 'cleanframe.weather.location.v1';
  var WEATHER_FRESH = 30 * 60 * 1000;
  var LOCATION_FRESH = 24 * 60 * 60 * 1000;
  var state = { weather: null, city: '', country: '', loading: false, error: null };
  var listeners = [];
  var pending = false;

  function now() { return Date.now(); }
  function read(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) {}
    }
  }
  function getJSON(url, callback) {
    var xhr, finished = false;
    function finish(err, data) {
      if (finished) return;
      finished = true;
      callback(err, data);
    }
    try { xhr = new XMLHttpRequest(); }
    catch (e) { finish(e); return; }
    xhr.open('GET', url, true);
    xhr.timeout = 9000;
    xhr.onreadystatechange = function () {
      var data;
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) { finish(new Error('Status ' + xhr.status)); return; }
      try { data = JSON.parse(xhr.responseText); }
      catch (e) { finish(e); return; }
      finish(null, data);
    };
    xhr.ontimeout = function () { finish(new Error('Timeout')); };
    xhr.onerror = function () { finish(new Error('Network error')); };
    try { xhr.send(); } catch (e) { finish(e); }
  }
  function validLocation(location) {
    return !!location && location.at &&
      isFinite(location.lat) && isFinite(location.lon) &&
      Math.abs(Number(location.lat)) <= 90 && Math.abs(Number(location.lon)) <= 180 &&
      !(Number(location.lat) === 0 && Number(location.lon) === 0) &&
      (now() - location.at) < LOCATION_FRESH;
  }
  function hasWeather(weather) {
    return !!weather && typeof weather.temp === 'number' && typeof weather.code === 'number' && !!weather.at;
  }
  function freshWeather(weather) {
    return hasWeather(weather) && (now() - weather.at) < WEATHER_FRESH;
  }

  var LABELS = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy',
    45: 'Fog', 48: 'Fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Storm with hail', 99: 'Storm with hail'
  };
  function weatherLabel(code) { return LABELS[code] || 'Weather'; }
  function weatherKind(code) {
    if (code === 0 || code === 1) return 'clear';
    if (code === 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 61 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'showers';
    if (code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloud';
  }

  function loadLocation(callback) {
    getJSON('https://ipwho.is/', function (err, data) {
      if (!err && data && data.success !== false &&
          data.latitude !== null && data.latitude !== undefined &&
          data.longitude !== null && data.longitude !== undefined &&
          isFinite(data.latitude) && isFinite(data.longitude)) {
        callback(null, {
          lat: Number(data.latitude), lon: Number(data.longitude),
          city: data.city || data.region || '',
          country: String(data.country_code || '').toUpperCase(), at: now()
        });
        return;
      }
      getJSON('https://geolocation-db.com/json/', function (err2, data2) {
        if (!err2 && data2 && data2.latitude !== null && data2.latitude !== undefined &&
            data2.longitude !== null && data2.longitude !== undefined &&
            isFinite(data2.latitude) && isFinite(data2.longitude)) {
          callback(null, {
            lat: Number(data2.latitude), lon: Number(data2.longitude),
            city: data2.city || '',
            country: String(data2.country_code || '').toUpperCase(), at: now()
          });
          return;
        }
        callback(err2 || err || new Error('Location unavailable'));
      });
    });
  }

  function loadWeather(location, callback) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(location.lat) +
      '&longitude=' + encodeURIComponent(location.lon) +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto';
    getJSON(url, function (err, data) {
      var current = data && data.current;
      if (err || !current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
        callback(err || new Error('Weather unavailable'));
        return;
      }
      callback(null, {
        temp: Math.round(current.temperature_2m),
        code: current.weather_code,
        feels: typeof current.apparent_temperature === 'number' ? Math.round(current.apparent_temperature) : null,
        humidity: typeof current.relative_humidity_2m === 'number' ? Math.round(current.relative_humidity_2m) : null,
        at: now()
      });
    });
  }

  function refresh(force) {
    if (pending) return;
    var cachedWeather = read(WEATHER_KEY), cachedLocation = read(LOCATION_KEY);
    if (cachedLocation && cachedLocation.city) state.city = cachedLocation.city;
    if (cachedLocation && cachedLocation.country) state.country = cachedLocation.country;
    if (hasWeather(cachedWeather)) state.weather = cachedWeather;
    var needsRegion = !cachedLocation || !cachedLocation.country;
    if (!force && freshWeather(cachedWeather) && !needsRegion) {
      emit();
      return;
    }

    pending = true;
    state.loading = true;
    emit();
    function done(err, weather) {
      pending = false;
      state.loading = false;
      if (err) { state.error = err; emit(); return; }
      state.weather = weather;
      state.error = null;
      write(WEATHER_KEY, weather);
      emit();
    }
    function weatherFor(location) {
      state.city = location.city || state.city;
      state.country = location.country || state.country;
      write(LOCATION_KEY, location);
      loadWeather(location, done);
    }
    if (validLocation(cachedLocation) && cachedLocation.country) weatherFor(cachedLocation);
    else loadLocation(function (err, location) {
      if (err) {
        pending = false;
        state.loading = false;
        state.error = err;
        emit();
      } else weatherFor(location);
    });
  }

  function init() {
    var weather = read(WEATHER_KEY), location = read(LOCATION_KEY);
    if (hasWeather(weather)) state.weather = weather;
    if (location && location.city) state.city = location.city;
    if (location && location.country) state.country = location.country;
  }
  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    if (state.weather) listener(state);
    return function () {
      var i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  init();
  window.CleanFrameStatus = {
    refresh: refresh,
    subscribe: subscribe,
    get: function () { return state; },
    country: function () { return state.country; },
    label: weatherLabel,
    kind: weatherKind
  };
}());
