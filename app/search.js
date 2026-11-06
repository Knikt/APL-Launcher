/* CleanFrame Universal Search - ES5 compatible for Tizen TV */
(function () {
  'use strict';

  var cache = { movies: {}, shows: {}, watch: {} };
  var WATCH_URL = 'https://apis.justwatch.com/graphql';
  var WATCH_QUERY = 'query CleanFrameWatch($country: Country!, $language: Language!, $filter: TitleFilter, $first: Int!) {' +
    'popularTitles(country: $country, filter: $filter, first: $first, sortBy: POPULAR) {' +
    'edges { node { id objectType content(country: $country, language: $language) {' +
    'title originalReleaseYear externalIds { imdbId } } ' +
    'offers(country: $country, platform: WEB, filter: {bestOnly: true}) {' +
    'standardWebURL monetizationType package { clearName technicalName } } } } } }';
  /* When one title streams on several services the tie-break decides which app
     is offered. Prime Video used to win every tie simply by sitting first, which
     sent almost every click to Prime; it now sorts after the services the owner
     actually browses by name. */
  /* Netflix has no working app on this set, so every Netflix offer is shown and
     opened as Nuvio, which plays the same title from its IMDb id. Nuvio sits in
     the place Netflix had in the order rather than at the end with the local
     apps. */
  var PROVIDER_ORDER = { nuviotv: 0, netflix: 0, hotstar: 1, appletv: 2, sonyliv: 3, disneyplus: 4, primevideo: 5 };
  var PROVIDER_NAMES = {
    primevideo: 'Prime Video', netflix: 'Netflix', hotstar: 'JioHotstar',
    disneyplus: 'Disney+', appletv: 'Apple TV', sonyliv: 'Sony LIV', nuviotv: 'Nuvio'
  };

  function fetchJSON(url, options, callback) {
    var finished = false;
    function finish(err, data) {
      if (finished) return;
      finished = true;
      callback(err, data);
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(options && options.method || 'GET', url, true);
      xhr.timeout = options && options.timeout || 7000;
      if (options && options.headers) {
        Object.keys(options.headers).forEach(function (k) {
          xhr.setRequestHeader(k, options.headers[k]);
        });
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var data = JSON.parse(xhr.responseText);
              finish(null, data);
            } catch (e) {
              finish(e, null);
            }
          } else {
            finish(new Error('Status ' + xhr.status), null);
          }
        }
      };
      xhr.ontimeout = function () { finish(new Error('Timeout'), null); };
      xhr.onerror = function () { finish(new Error('Network error'), null); };
      xhr.send(options && options.body || null);
    } catch (err) {
      finish(err, null);
    }
  }

  /* A title with no recognised offer is not attributed to any streaming app.
     The badge stays empty while availability is loading, and the card is
     removed once JustWatch has answered without a usable offer. Nuvio is a
     local library, not a regional JustWatch offer, so it must never win by
     default over JioHotstar, Apple TV, Sony LIV, Netflix or Prime Video. */

  function searchLocalApps(q, allApps) {
    if (!allApps || !allApps.length) return [];
    var query = (q || '').trim().toLowerCase();
    if (!query) return allApps.slice(0, 8);
    return allApps.filter(function (a) {
      var name = (a.name || '').toLowerCase();
      var id = (a.id || '').toLowerCase();
      var appId = (a.appId || '').toLowerCase();
      return name.indexOf(query) >= 0 || id.indexOf(query) >= 0 || appId.indexOf(query) >= 0;
    }).slice(0, 10);
  }

  /* Cached catalogue rows are pristine. Availability is written onto a copy so
     a later search never inherits a badge or URL from an earlier one, and a
     failed availability request cannot leave a stale provider on screen. */
  function cloneItems(list) {
    var copy = [], i, key;
    if (!list) return copy;
    for (i = 0; i < list.length; i++) {
      var item = {}, source = list[i];
      for (key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) item[key] = source[key];
      }
      copy.push(item);
    }
    return copy;
  }

  function searchMovies(q, callback) {
    var query = (q || '').trim();
    var key = query.toLowerCase() || '__popular__';
    if (cache.movies[key]) {
      callback(null, cloneItems(cache.movies[key]));
      return;
    }
    var url = query
      ? 'https://v3-cinemeta.strem.io/catalog/movie/top/search=' + encodeURIComponent(query) + '.json'
      : 'https://v3-cinemeta.strem.io/catalog/movie/top.json';

    fetchJSON(url, null, function (err, data) {
      if (err || !data || !data.metas) {
        callback(null, getFallbackMovies(query));
        return;
      }
      var list = [];
      for (var i = 0; i < data.metas.length && list.length < 16; i++) {
        var m = data.metas[i];
        if (!m || !m.name || !m.poster) continue;
        list.push({
          id: m.id || ('m_' + i),
          title: m.name,
          year: m.releaseInfo || m.year || '',
          poster: m.poster,
          background: m.background || '',
          rating: m.imdbRating || '',
          provider: '',
          baseProvider: '',
          type: 'movie',
          description: m.description || ''
        });
      }
      cache.movies[key] = list;
      callback(null, cloneItems(list));
    });
  }

  function searchShows(q, callback) {
    var query = (q || '').trim();
    var key = query.toLowerCase() || '__popular__';
    if (cache.shows[key]) {
      callback(null, cloneItems(cache.shows[key]));
      return;
    }
    var url = query
      ? 'https://v3-cinemeta.strem.io/catalog/series/top/search=' + encodeURIComponent(query) + '.json'
      : 'https://v3-cinemeta.strem.io/catalog/series/top.json';

    fetchJSON(url, null, function (err, data) {
      if (err || !data || !data.metas) {
        callback(null, getFallbackShows(query));
        return;
      }
      var list = [];
      for (var i = 0; i < data.metas.length && list.length < 12; i++) {
        var m = data.metas[i];
        if (!m || !m.name || !m.poster) continue;
        list.push({
          id: m.id || ('s_' + i),
          title: m.name,
          year: m.releaseInfo || m.year || '',
          poster: m.poster,
          background: m.background || '',
          rating: m.imdbRating || '',
          provider: '',
          baseProvider: '',
          type: 'series',
          description: m.description || ''
        });
      }
      cache.shows[key] = list;
      callback(null, cloneItems(list));
    });
  }

  function searchYouTube(q, callback) {
    /* YouTube's search endpoint does not send CORS headers, so a Tizen web
       app cannot read results. Return an honest shortcut to the TV app's
       search page instead of unrelated fallback videos. */
    callback(null, getFallbackYouTube((q || '').trim()));
  }

  /* Samsung Universal Search receives provider-defined deeplink payloads. There
     is no public catalogue of those payloads. JustWatch supplies real regional
     offers, which lets us choose the correct app and gives Prime Video the GTI
     needed for its documented app-control payload. */
  function countryCode() {
    var c = window.CleanFrameStatus && window.CleanFrameStatus.country && window.CleanFrameStatus.country();
    if (c && /^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
    var lang = navigator.language || navigator.userLanguage || '';
    var m = /[-_]([A-Za-z]{2})$/.exec(lang);
    if (m) return m[1].toUpperCase();
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (tz.indexOf('Kolkata') >= 0 || tz.indexOf('Calcutta') >= 0) return 'IN';
    if (tz.indexOf('London') >= 0) return 'GB';
    if (tz.indexOf('Sydney') >= 0 || tz.indexOf('Melbourne') >= 0) return 'AU';
    if (tz.indexOf('Tokyo') >= 0) return 'JP';
    if (tz.indexOf('Dubai') >= 0) return 'AE';
    if (tz.indexOf('Singapore') >= 0) return 'SG';
    if (tz.indexOf('America/') === 0 || tz.indexOf('US/') === 0) return 'US';
    return 'US';
  }

  function emptyWatch() {
    return { byImdb: {}, byKey: {}, byTitle: {}, loaded: false };
  }

  function titleKey(title, year) {
    var clean = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
    var y = String(year || '').match(/\d{4}/);
    return clean ? clean + '|' + (y ? y[0] : '') : '';
  }

  function titleOnlyKey(title) {
    return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function providerFor(offer) {
    var pkg = offer && offer.package && (offer.package.technicalName || offer.package.clearName) || '';
    var name = String(pkg).toLowerCase();
    /* Amazon third-party channels (Apple TV, SonyLIV, Sony Pictures) are
       purchased and played inside Prime Video, so they must not be routed to
       the standalone app that happens to share their brand name. */
    if (name.indexOf('amazon') === 0 || name.indexOf('prime video') >= 0) return 'primevideo';
    if (name.indexOf('netflix') >= 0) return 'netflix';
    if (name.indexOf('jiohotstar') >= 0 || name.indexOf('hotstar') >= 0) return 'hotstar';
    if (name.indexOf('disney') >= 0) return 'disneyplus';
    if (name.indexOf('itunes') >= 0 || name.indexOf('appletv') >= 0 || name.indexOf('apple tv') >= 0) return 'appletv';
    if (name.indexOf('sonyliv') >= 0 || name.indexOf('sony liv') >= 0) return 'sonyliv';
    return '';
  }

  function offerRank(offer) {
    var type = String(offer && offer.monetizationType || '').toUpperCase();
    if (type === 'FLATRATE' || type === 'FREE') return 0;
    if (type === 'ADS') return 1;
    if (type === 'RENT') return 2;
    if (type === 'BUY') return 3;
    return 4;
  }

  function gtiFromUrl(url) {
    var m = /[?&]gti=([^&]+)/.exec(url || '');
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  function chooseOffer(offers) {
    var chosen = {}, order = [];
    for (var i = 0; i < offers.length; i++) {
      var offer = offers[i];
      var provider = providerFor(offer);
      if (!provider) continue;
      var candidate = {
        provider: provider,
        name: PROVIDER_NAMES[provider] || '',
        url: offer.standardWebURL || '',
        gti: provider === 'primevideo' ? gtiFromUrl(offer.standardWebURL) : '',
        rank: offerRank(offer),
        monetizationType: offer.monetizationType || ''
      };
      if (!chosen[provider]) {
        chosen[provider] = candidate;
        order.push(provider);
      } else {
        var old = chosen[provider];
        var better = candidate.rank < old.rank ||
          (candidate.rank === old.rank && candidate.gti && !old.gti);
        if (better) chosen[provider] = candidate;
      }
    }
    order.sort(function (a, b) {
      var ar = chosen[a].rank, br = chosen[b].rank;
      if (ar !== br) return ar - br;
      return (PROVIDER_ORDER[a] === undefined ? 99 : PROVIDER_ORDER[a]) -
        (PROVIDER_ORDER[b] === undefined ? 99 : PROVIDER_ORDER[b]);
    });
    return order.length ? chosen[order[0]] : null;
  }

  function searchJustWatch(q, callback) {
    var query = (q || '').trim();
    var key = countryCode() + '|' + (query.toLowerCase() || '__popular__');
    if (cache.watch[key]) {
      callback(null, cache.watch[key]);
      return;
    }
    var body = JSON.stringify({
      operationName: 'CleanFrameWatch',
      query: WATCH_QUERY,
      variables: {
        country: countryCode(),
        language: 'en',
        filter: query ? { searchQuery: query } : null,
        first: 50
      }
    });
    fetchJSON(WATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
      body: body
    }, function (err, data) {
      var watch = emptyWatch();
      if (!err && data && data.data && data.data.popularTitles && data.data.popularTitles.edges) {
        var edges = data.data.popularTitles.edges;
        for (var i = 0; i < edges.length; i++) {
          var node = edges[i] && edges[i].node;
          if (!node || !node.content) continue;
          var content = node.content;
          var entry = { offers: node.offers || [] };
          var imdb = content.externalIds && content.externalIds.imdbId;
          var byTitle = titleKey(content.title, content.originalReleaseYear);
          var byName = titleOnlyKey(content.title);
          if (imdb) {
            if (!watch.byImdb[imdb]) watch.byImdb[imdb] = { offers: [] };
            watch.byImdb[imdb].offers = watch.byImdb[imdb].offers.concat(entry.offers);
          }
          if (byTitle) {
            if (!watch.byKey[byTitle]) watch.byKey[byTitle] = { offers: [] };
            watch.byKey[byTitle].offers = watch.byKey[byTitle].offers.concat(entry.offers);
          }
          /* A title-only tier catches the common mismatch where the catalogue
             and the search disagree on the release year (re-edits, festival vs
             theatrical cuts) or the popularity page ranks a sequel first. */
          if (byName) {
            if (!watch.byTitle[byName]) watch.byTitle[byName] = { buckets: {} };
            var group = watch.byTitle[byName];
            var yearBucket = String(content.originalReleaseYear || '');
            if (!group.buckets[yearBucket]) group.buckets[yearBucket] = { offers: [] };
            group.buckets[yearBucket].offers = group.buckets[yearBucket].offers.concat(entry.offers);
          }
        }
        watch.loaded = true;
      }
      if (watch.loaded) cache.watch[key] = watch;
      callback(null, watch);
    });
  }

  /* A title-only match is only trustworthy within the same year, or one year
     either side for festival and regional releases. Offers are grouped by year
     so a 2005 film called "Severance" cannot inherit the 2022 Apple TV show's
     offer. A card without a year still falls back to every same-title offer. */
  function offersByTitle(item, watch) {
    var group = watch.byTitle[titleOnlyKey(item && item.title)];
    if (!group) return null;
    var mine = String(item && item.year || '').match(/\d{4}/), key, best = null, bestDiff = 2, diff, year;
    if (!mine) {
      /* With no year to verify, only an unambiguous title match is safe. */
      var found = 0, only = null, k;
      for (k in group.buckets) {
        if (!Object.prototype.hasOwnProperty.call(group.buckets, k)) continue;
        if (group.buckets[k].offers.length) { found++; only = group.buckets[k]; }
      }
      return found === 1 ? only : null;
    }
    if (group.buckets[mine[0]]) return group.buckets[mine[0]];
    for (key in group.buckets) {
      if (!Object.prototype.hasOwnProperty.call(group.buckets, key) || !/^\d{4}$/.test(key)) continue;
      year = Number(key);
      diff = Math.abs(year - Number(mine[0]));
      if (diff <= 1 && diff < bestDiff) { bestDiff = diff; best = group.buckets[key]; }
    }
    return best;
  }

  function offerFor(item, watch) {
    var entry = item && item.id && watch.byImdb[item.id];
    if (!entry) entry = watch.byKey[titleKey(item && item.title, item && item.year)];
    if (!entry) entry = offersByTitle(item, watch);
    return entry ? chooseOffer(entry.offers) : null;
  }

  function applyWatchOffers(list, watch) {
    if (!list || !list.length) return;
    var loaded = !!(watch && watch.loaded);
    for (var i = 0; i < list.length; i++) {
      var item = list[i], offer = offerFor(item, watch), fallback = item.baseProvider || item.provider || '';
      /* Partial results carry no badge at all: a card may only name a service
         once JustWatch has actually confirmed the offer. Once the answer has
         arrived, an unmatched card has no provider and is removed before the
         final render, rather than being sent to a library app by default. */
      item.provider = offer ? offer.provider : (loaded ? '' : fallback);
      item.webUrl = offer ? offer.url : '';
      /* Netflix results are Nuvio results. The badge, the card and the click all
         say Nuvio and go through its IMDb route, which is the only app on this
         set that opens the exact title - and the card keeps the IMDb id it was
         matched by, so that route has what it needs. */
      if (item.provider === 'netflix') {
        item.provider = 'nuviotv';
        item.webUrl = '';
        item.gti = '';
        item.baseProvider = 'nuviotv';
      }
      item.gti = offer && offer.provider === 'primevideo' ? offer.gti : '';
      item.direct = !!(offer && offer.provider === 'primevideo' && offer.gti);
      item.monetizationType = offer ? offer.monetizationType : '';
    }
  }

  /* Once availability has loaded, keep only titles with a real offer and put
     the services the owner browses first. Removing unmatched cards prevents a
     search for a JioHotstar or Apple TV title from filling the row with local
     Nuvio lookalikes. */
  function finalizeAvailability(list, loaded) {
    if (!list) return [];
    if (!loaded) return list;
    var kept = [], i, rank;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].provider) kept.push(list[i]);
    }
    kept.sort(function (a, b) {
      var ar = PROVIDER_ORDER[a.provider], br = PROVIDER_ORDER[b.provider];
      ar = ar === undefined ? 99 : ar;
      br = br === undefined ? 99 : br;
      return ar - br;
    });
    return kept;
  }

  function getFallbackMovies(q) {
    return [
      { id: 'tt1375666', title: 'Inception', year: '2010', poster: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt1375666/img', provider: 'primevideo', baseProvider: 'primevideo', type: 'movie' },
      { id: 'tt0816692', title: 'Interstellar', year: '2014', poster: 'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt0816692/img', provider: 'primevideo', baseProvider: 'primevideo', type: 'movie' },
      { id: 'tt15398776', title: 'Oppenheimer', year: '2023', poster: 'https://m.media-amazon.com/images/M/MV5BMDBmYTZjNjUtN2M1MS00MTQ2LTk2ODgtNzc2M2QyZGE5NTVjXkEyXkFqcGdeQXVyNzAwMjU2MTY@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt15398776/img', provider: 'hotstar', baseProvider: 'hotstar', type: 'movie' },
      { id: 'tt0468569', title: 'The Dark Knight', year: '2008', poster: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt0468569/img', provider: 'nuviotv', baseProvider: 'nuviotv', type: 'movie' },
      { id: 'tt15239678', title: 'Dune: Part Two', year: '2024', poster: 'https://m.media-amazon.com/images/M/MV5BN2QyZGU4ZDctOWMzMy00NWUzLWI1ZmEtZSZkNmH0NGVkZTIxXkEyXkFqcGdeQXVyMDM2NDM2MQ@@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt15239678/img', provider: 'primevideo', baseProvider: 'primevideo', type: 'movie' },
      { id: 'tt1630029', title: 'Avatar: The Way of Water', year: '2022', poster: 'https://m.media-amazon.com/images/M/MV5BYjhiNjBlODctY2ZiOC00YjVlLWFlNzAtNTVhNzM1YjI1NzMxXkEyXkFqcGdeQXVyMjkwOTAyMDU@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt1630029/img', provider: 'hotstar', baseProvider: 'hotstar', type: 'movie' }
    ];
  }

  function getFallbackShows(q) {
    return [
      { id: 'tt4574334', title: 'Stranger Things', year: '2016', poster: 'https://m.media-amazon.com/images/M/MV5BMjEzMDAxOTUyMV5BMl5BanBnXkFtZTgwNzAxMDYzOTE@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt4574334/img', provider: 'nuviotv', baseProvider: 'nuviotv', type: 'series' },
      { id: 'tt3581920', title: 'The Last of Us', year: '2023', poster: 'https://m.media-amazon.com/images/M/MV5BZGUzYTI3M2EtZmM0Yy00NGUyLWI4ODEtN2Q3ZGJlYzhhZjU3XkEyXkFqcGdeQXVyNTkyMDcwNTU@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt3581920/img', provider: 'hotstar', baseProvider: 'hotstar', type: 'series' },
      { id: 'tt11280740', title: 'Severance', year: '2022', poster: 'https://m.media-amazon.com/images/M/MV5BMzY1ZjMwMGEtYTY1ZS00ZDllLTk0ZmUtYzA3ZTA4NmYwNGNkXkEyXkFqcGdeQXVyNDAzNDk0MTQ@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt11280740/img', provider: 'appletv', baseProvider: 'appletv', type: 'series' },
      { id: 'tt7660850', title: 'Succession', year: '2018', poster: 'https://m.media-amazon.com/images/M/MV5BZDE0ODgwNjMtODUxYS00OWY0LTk5ZDMtNGU0MGMzNWQyMGU0XkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_SX300.jpg', background: 'https://images.metahub.space/background/medium/tt7660850/img', provider: 'hotstar', baseProvider: 'hotstar', type: 'series' }
    ];
  }

  function getFallbackYouTube(q) {
    if (!q) return [];
    return [
      { id: 'yt_search', search: true, searchQuery: q, title: 'Search YouTube for "' + q + '"', channel: 'Open the YouTube search page', thumbnail: 'assets/icons/youtube.svg', badge: 'youtube', type: 'youtube' }
    ];
  }

  function executeSearch(query, allInstalledApps, callback) {
    var q = (query || '').trim();
    var apps = searchLocalApps(q, allInstalledApps);
    var results = { query: q, apps: apps, movies: [], shows: [], youtube: [], watchLoaded: false, watchLoading: true };
    var pending = 4;
    var partialSent = false;
    var watchDone = false;

    function partial() {
      if (partialSent || watchDone) return;
      partialSent = true;
      applyWatchOffers(results.movies, emptyWatch());
      applyWatchOffers(results.shows, emptyWatch());
      results.watchLoading = true;
      callback(results);
    }

    function finish() {
      pending--;
      if (pending <= 0) {
        var watch = results.watch || emptyWatch();
        applyWatchOffers(results.movies, watch);
        applyWatchOffers(results.shows, watch);
        results.movies = finalizeAvailability(results.movies, results.watchLoaded);
        results.shows = finalizeAvailability(results.shows, results.watchLoaded);
        results.watchLoading = false;
        callback(results);
      } else if (pending === 1) {
        partial();
      }
    }

    searchMovies(q, function (err, movies) {
      results.movies = movies || [];
      finish();
    });

    searchShows(q, function (err, shows) {
      results.shows = shows || [];
      finish();
    });

    searchYouTube(q, function (err, yt) {
      results.youtube = yt || [];
      finish();
    });

    searchJustWatch(q, function (err, watch) {
      watchDone = true;
      results.watch = watch || emptyWatch();
      results.watchLoaded = !!(watch && watch.loaded);
      finish();
    });
  }

  function clearCache() {
    cache.movies = {};
    cache.shows = {};
    cache.watch = {};
  }

  window.CleanFrameSearch = {
    search: executeSearch,
    searchYouTube: searchYouTube,
    searchJustWatch: searchJustWatch,
    countryCode: countryCode,
    clearCache: clearCache
  };
}());
