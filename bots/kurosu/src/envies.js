'use strict';
// Envies (« 😂 Rigoler », « 💕 Romance »…) : comme dans Kurosu, chaque envie se traduit
// en filtres TMDB classiques, sans IA. Reprise des réglages « film » de
// web/src/lib/ambiances.js (Kurosu) ; « Sport » n'a pas de réglage film, il n'est donc pas proposé.

const ENVIES = [
  { cle: 'rire', emoji: '😂', genre: 35 },
  { cle: 'romance', emoji: '💕', genre: 10749 },
  { cle: 'frissons', emoji: '😱', genre: 27 },
  { cle: 'adrenaline', emoji: '🔥', genre: 28 },
  { cle: 'emotion', emoji: '😢', genre: 18, tri: 'note' },
  { cle: 'cerveau', emoji: '🤯', genre: 9648, tri: 'note' },
  { cle: 'enquete', emoji: '🕵️', genre: 80 },
  { cle: 'evasion', emoji: '🌌', genre: 14 },
  { cle: 'doux', emoji: '☕', genre: 10751 },
  { cle: 'deuxHeures', emoji: '⏱', temps: 120 },
];

const NOMS = {
  fr: {
    rire: ['Rigoler', 'Des comédies pour rire un bon coup.'],
    romance: ['Romance', "Des histoires d'amour, pour les cœurs tendres."],
    frissons: ['Frissons', 'De quoi avoir peur, ou au moins sursauter.'],
    adrenaline: ['Adrénaline', "De l'action, du rythme, des combats."],
    emotion: ['Émotion', 'Des drames parmi les mieux notés : prévois les mouchoirs.'],
    cerveau: ['Cerveau retourné', 'Des énigmes et des scénarios qui font réfléchir.'],
    enquete: ['Enquête', 'Crimes, enquêtes et coupables à démasquer.'],
    evasion: ['Évasion', "Des mondes imaginaires pour s'évader."],
    doux: ['Doux', 'Des histoires légères et reposantes, pour se détendre.'],
    deuxHeures: ["J'ai 2 h", 'Ce que tu peux finir en deux heures maximum.'],
  },
  en: {
    rire: ['Laugh', 'Comedies for a good laugh.'],
    romance: ['Romance', 'Love stories, for the tender-hearted.'],
    frissons: ['Chills', 'Something to scare you, or at least make you jump.'],
    adrenaline: ['Adrenaline', 'Action, pace and fights.'],
    emotion: ['Feels', 'Some of the best-rated dramas: keep tissues nearby.'],
    cerveau: ['Mind-bending', 'Puzzles and plots that make you think.'],
    enquete: ['Whodunit', 'Crimes, investigations and culprits to unmask.'],
    evasion: ['Escape', 'Imaginary worlds to get away.'],
    doux: ['Cozy', 'Light, relaxing stories to unwind.'],
    deuxHeures: ['I have 2h', 'What you can finish in two hours or less.'],
  },
};

const GENRE_ANIMATION = 16;
const PAGES_MAX = 5; // « Autres idées » tourne sur les 5 premières pages (100 films), puis revient au début

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const envie = (cle) => ENVIES.find((e) => e.cle === cle) || null;
const nom = (e, lang) => (NOMS[lang] || NOMS.fr)[e.cle][0];
const phrase = (e, lang) => (NOMS[lang] || NOMS.fr)[e.cle][1];
const libelle = (e, lang) => `${e.emoji} ${nom(e, lang)}`;

/** « rire », « Rigoler », « laugh », « 2h »… → l'envie correspondante, ou null. */
function trouverEnvie(texte) {
  const q = norm(texte);
  if (!q) return null;
  if (['2h', '2heures', 'jai2h', 'ihave2h', 'deuxheures'].includes(q)) return envie('deuxHeures');
  return ENVIES.find((e) => norm(e.cle) === q || Object.values(NOMS).some((n) => norm(n[e.cle][0]) === q)) || null;
}

/** Paramètres /discover/movie de l'envie (mêmes seuils que Kurosu, server/sources/tmdb.js). */
function parametresDiscover(e, { language, page = 1 }) {
  return {
    language,
    page,
    with_genres: e.genre || undefined,
    ...(e.tri === 'note'
      ? { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } // assez de votes : pas de 10/10 à 3 votes
      : { sort_by: 'popularity.desc', 'vote_count.gte': 100 }),
    ...(e.temps && { 'with_runtime.lte': e.temps, 'with_runtime.gte': 40 }), // 40 min : sans les courts-métrages
  };
}

// L'animation japonaise relève du catalogue anime (AniList) dans Kurosu : on l'écarte ici aussi.
const estUnAnime = (m) => m.original_language === 'ja' && (m.genre_ids || []).includes(GENRE_ANIMATION);

/** Boutons du menu des envies : 10 envies, 3 par ligne (≤ 4 par ligne, ≤ 5 lignes côté GPChat). */
function boutonsEnvies(lang, btn) {
  const lignes = [];
  for (let i = 0; i < ENVIES.length; i += 3) {
    lignes.push(ENVIES.slice(i, i + 3).map((e) => btn.callback(libelle(e, lang), `e:${e.cle}`)));
  }
  return lignes;
}

const pageSuivante = (page) => (page >= PAGES_MAX ? 1 : page + 1);

module.exports = { ENVIES, envie, nom, phrase, libelle, trouverEnvie, parametresDiscover, estUnAnime, boutonsEnvies, pageSuivante, PAGES_MAX };
