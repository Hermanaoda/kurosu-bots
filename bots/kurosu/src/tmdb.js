'use strict';
// Client minimal TMDB (v3) + OMDb. Le jeton TMDB est le « Read Access Token » (v4) : jamais dans le code.
// Un petit cache mémoire évite de refaire les mêmes requêtes (limites TMDB/OMDb).

const IMG = 'https://image.tmdb.org/t/p';

class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}

class Cache {
  constructor(ttlMs, max = 500) { this.ttl = ttlMs; this.max = max; this.map = new Map(); }
  get(k) {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.at + this.ttl < Date.now()) { this.map.delete(k); return undefined; }
    return e.v;
  }
  set(k, v) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(k, { v, at: Date.now() });
  }
}

class Tmdb {
  constructor({ token, fetchImpl = fetch, baseUrl = 'https://api.themoviedb.org/3', cacheTtlMs = 10 * 60 * 1000, timeoutMs = 8000 }) {
    if (!token) throw new Error('TMDB_TOKEN manquant');
    this.token = token; this.fetch = fetchImpl; this.base = baseUrl; this.timeout = timeoutMs; this.cache = new Cache(cacheTtlMs);
  }

  async get(path, params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const url = `${this.base}${path}?${qs}`;
    const hit = this.cache.get(url);
    if (hit) return hit;
    const res = await this.fetch(url, { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeout) });
    if (!res.ok) throw new ApiError(`TMDB ${res.status}`, res.status);
    const json = await res.json();
    this.cache.set(url, json);
    return json;
  }

  searchMovie(query, language) { return this.get('/search/movie', { query, language, include_adult: false }).then((r) => r.results || []); }
  searchPerson(query, language) { return this.get('/search/person', { query, language, include_adult: false }).then((r) => r.results || []); }
  movie(id, language) { return this.get(`/movie/${id}`, { language, append_to_response: 'credits,videos,watch/providers,external_ids' }); }
  person(id, language) { return this.get(`/person/${id}`, { language, append_to_response: 'movie_credits' }); }
  trending(language) { return this.get('/trending/movie/week', { language }).then((r) => r.results || []); }
  upcoming(language, region) { return this.get('/movie/upcoming', { language, region }).then((r) => r.results || []); }
  similar(id, language) { return this.get(`/movie/${id}/similar`, { language }).then((r) => r.results || []); }
  discover(params) { return this.get('/discover/movie', { include_adult: false, sort_by: 'popularity.desc', ...params }).then((r) => r.results || []); }

  static poster(path, size = 'w500') { return path ? `${IMG}/${size}${path}` : ''; }
}

class Omdb {
  constructor({ apiKey, fetchImpl = fetch, cacheTtlMs = 60 * 60 * 1000, timeoutMs = 6000 }) {
    this.key = apiKey; this.fetch = fetchImpl; this.timeout = timeoutMs; this.cache = new Cache(cacheTtlMs);
  }

  /** Notes IMDb / Rotten Tomatoes / Metacritic pour un identifiant IMDb (ttXXXXXXX). Renvoie null si indisponible. */
  async byImdbId(imdbId) {
    if (!this.key || !/^tt\d+$/.test(imdbId || '')) return null;
    const hit = this.cache.get(imdbId);
    if (hit !== undefined) return hit;
    try {
      const res = await this.fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${encodeURIComponent(this.key)}`, { signal: AbortSignal.timeout(this.timeout) });
      const j = res.ok ? await res.json() : null;
      if (!j || j.Response === 'False') { this.cache.set(imdbId, null); return null; }
      const rt = (j.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes');
      const out = {
        imdbRating: j.imdbRating && j.imdbRating !== 'N/A' ? j.imdbRating : null,
        imdbVotes: j.imdbVotes && j.imdbVotes !== 'N/A' ? j.imdbVotes : null,
        metascore: j.Metascore && j.Metascore !== 'N/A' ? j.Metascore : null,
        rottenTomatoes: rt ? rt.Value : null,
        awards: j.Awards && j.Awards !== 'N/A' ? j.Awards : null,
      };
      this.cache.set(imdbId, out);
      return out;
    } catch { return null; } // OMDb est un bonus : ne jamais faire échouer la fiche
  }
}

module.exports = { Tmdb, Omdb, ApiError, Cache };
