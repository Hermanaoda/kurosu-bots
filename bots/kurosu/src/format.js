'use strict';
const { t } = require('./i18n');
const { Tmdb } = require('./tmdb');

const GENRES = {
  action: 28, aventure: 12, adventure: 12, animation: 16, comedie: 35, comedy: 35, crime: 80, documentaire: 99, documentary: 99,
  drame: 18, drama: 18, famille: 10751, family: 10751, fantastique: 14, fantasy: 14, histoire: 36, history: 36, horreur: 27, horror: 27,
  musique: 10402, music: 10402, mystere: 9648, mystery: 9648, romance: 10749, science_fiction: 878, 'science-fiction': 878, scifi: 878,
  thriller: 53, guerre: 10752, war: 10752, western: 37,
};

const NAMES = { fr: { 28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime', 99: 'Documentaire', 18: 'Drame', 10751: 'Famille', 14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique', 9648: 'Mystère', 10749: 'Romance', 878: 'Science-fiction', 53: 'Thriller', 10752: 'Guerre', 37: 'Western' },
  en: { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science fiction', 53: 'Thriller', 10752: 'War', 37: 'Western' } };
const genreName = (id, lang) => (NAMES[lang] || NAMES.fr)[id] || '?';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const genreId = (name) => GENRES[norm(name).replace(/\s+/g, '_')] ?? null;
const genreList = () => ['action', 'aventure', 'animation', 'comédie', 'crime', 'documentaire', 'drame', 'famille', 'fantastique', 'horreur', 'romance', 'science_fiction', 'thriller'];

const year = (d) => (d ? String(d).slice(0, 4) : '');
const clip = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x; };
const hm = (min, lang) => (min ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} (${min} ${t(lang, 'minutes')})` : t(lang, 'unknown'));

/** Ligne d'une liste : « 1. Titre (2018) ⭐ 7,3 » */
function listLine(m, i, lang) {
  const r = m.vote_average ? ` ⭐ ${m.vote_average.toFixed(1)}` : '';
  const y = year(m.release_date);
  return `${i + 1}. ${m.title || m.name}${y ? ` (${y})` : ''}${r}`;
}

/** Boutons « choisir un film » (un par ligne, 5 lignes max, callback m:<id>). */
function pickButtons(results, btn) {
  return results.slice(0, 5).map((m) => [btn.callback(clip(`${m.title}${m.release_date ? ` (${year(m.release_date)})` : ''}`, 32), `m:${m.id}`)]);
}

/** Fiche film : texte brut (légende d'image, sans Markdown) + affiche + boutons. */
function movieCard(movie, omdb, lang, btn, country) {
  const crew = (movie.credits && movie.credits.crew) || [];
  const director = crew.filter((c) => c.job === 'Director').map((c) => c.name).slice(0, 2).join(', ');
  const cast = ((movie.credits && movie.credits.cast) || []).slice(0, 5).map((c) => c.name).join(', ');
  const genres = (movie.genres || []).map((g) => g.name).join(', ');
  const lines = [`🎬 ${movie.title}${movie.release_date ? ` (${year(movie.release_date)})` : ''}`];
  if (movie.tagline) lines.push(`« ${clip(movie.tagline, 120)} »`);
  const ratings = [];
  if (omdb && omdb.imdbRating) ratings.push(`IMDb ${omdb.imdbRating}/10`);
  if (omdb && omdb.rottenTomatoes) ratings.push(`🍅 ${omdb.rottenTomatoes}`);
  if (omdb && omdb.metascore) ratings.push(`Metacritic ${omdb.metascore}`);
  if (movie.vote_average) ratings.push(`TMDB ${movie.vote_average.toFixed(1)}/10`);
  if (ratings.length) lines.push(`⭐ ${ratings.join(' · ')}`);
  lines.push(`⏱️ ${hm(movie.runtime, lang)}${genres ? ` · ${genres}` : ''}`);
  if (director) lines.push(`🎥 ${t(lang, 'director')} : ${director}`);
  if (cast) lines.push(`👥 ${cast}`);
  if (omdb && omdb.awards) lines.push(`🏆 ${clip(omdb.awards, 110)}`);
  if (movie.overview) lines.push('', clip(movie.overview, 420));
  const rows = [
    [btn.callback(t(lang, 'btnWhere'), `w:${movie.id}`), btn.callback(t(lang, 'btnSimilar'), `s:${movie.id}`)],
    [btn.callback(t(lang, 'btnList'), `a:${movie.id}`)],
  ];
  const trailer = ((movie.videos && movie.videos.results) || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  if (trailer) rows[1].push(btn.link(t(lang, 'btnTrailer'), `https://www.youtube.com/watch?v=${trailer.key}`));
  return { caption: clip(lines.join('\n'), 1000), poster: Tmdb.poster(movie.poster_path), buttons: rows, country };
}

/** Fiche acteur / actrice. */
function personCard(person, lang, btn) {
  const credits = ((person.movie_credits && person.movie_credits.cast) || [])
    .filter((c) => c.title && c.vote_count > 200).sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  const lines = [`🎭 ${person.name}`];
  if (person.birthday) lines.push(`🎂 ${t(lang, 'born')} : ${person.birthday}${person.place_of_birth ? ` — ${person.place_of_birth}` : ''}`);
  if (credits.length) lines.push(`🎬 ${t(lang, 'knownFor')} : ${credits.map((c) => c.title).join(', ')}`);
  if (person.biography) lines.push('', clip(person.biography, 520));
  const rows = credits.slice(0, 4).map((c) => [btn.callback(clip(c.title, 32), `m:${c.id}`)]);
  return { caption: clip(lines.join('\n'), 1000), poster: Tmdb.poster(person.profile_path), buttons: rows };
}

/** Plateformes de streaming pour un pays (données JustWatch via TMDB). */
function providersText(movie, country, lang) {
  const p = movie['watch/providers'] && movie['watch/providers'].results && movie['watch/providers'].results[country];
  const head = t(lang, 'whereTitle', { title: movie.title, country });
  if (!p) return `${head}\n\n${t(lang, 'whereNone', { country })}`;
  const part = (label, arr) => (arr && arr.length ? `**${label}** : ${arr.map((x) => x.provider_name).join(', ')}` : null);
  const body = [part(t(lang, 'stream'), p.flatrate), part(t(lang, 'free'), p.free || p.ads), part(t(lang, 'rent'), p.rent), part(t(lang, 'buy'), p.buy)].filter(Boolean);
  if (!body.length) return `${head}\n\n${t(lang, 'whereNone', { country })}`;
  return `${head}\n\n${body.join('\n')}${p.link ? `\n\n${p.link}` : ''}`;
}

function compareText(a, b, oa, ob, lang) {
  const v = (x) => (x == null || x === '' ? '—' : x);
  const rate = (m, o) => (o && o.imdbRating ? `${o.imdbRating} (IMDb)` : m.vote_average ? `${m.vote_average.toFixed(1)} (TMDB)` : '—');
  return [
    t(lang, 'compareTitle', { a: a.title, b: b.title }), '',
    `**${t(lang, 'cmpRating')}** : ${rate(a, oa)}  |  ${rate(b, ob)}`,
    `**${t(lang, 'cmpYear')}** : ${v(year(a.release_date))}  |  ${v(year(b.release_date))}`,
    `**${t(lang, 'cmpRuntime')}** : ${v(a.runtime)} ${t(lang, 'minutes')}  |  ${v(b.runtime)} ${t(lang, 'minutes')}`,
    `**${t(lang, 'genres')}** : ${(a.genres || []).map((g) => g.name).join(', ') || '—'}  |  ${(b.genres || []).map((g) => g.name).join(', ') || '—'}`,
  ].join('\n');
}

/** Indice de quiz : le synopsis dont le titre est masqué. */
function maskTitle(overview, title) {
  const words = norm(title).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  let out = String(overview || '');
  for (const w of words) out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), '█████');
  return clip(out, 380);
}

module.exports = { genreName, GENRES, genreId, genreList, listLine, pickButtons, movieCard, personCard, providersText, compareText, maskTitle, clip, norm, year };
