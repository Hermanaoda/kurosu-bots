'use strict';
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, parseCommand } = require('../src/handlers');
const { Tmdb, Omdb } = require('../src/tmdb');
const { Store } = require('../src/store');
const F = require('../src/format');
const { button } = require('../../../packages/sdk');

const DUNE = { id: 1, title: 'Dune', release_date: '2021-09-15', vote_average: 7.8, overview: 'Paul Atreides rejoint la planète Dune pour sauver sa famille.', poster_path: '/dune.jpg', genre_ids: [878] };
const movieFull = (id, title) => ({
  id, title, release_date: '2021-09-15', runtime: 155, vote_average: 7.8, tagline: 'Beyond fear', overview: 'Un synopsis.', poster_path: '/p.jpg',
  genres: [{ name: 'Science-fiction' }], credits: { crew: [{ job: 'Director', name: 'Denis Villeneuve' }], cast: [{ name: 'Timothée Chalamet' }, { name: 'Zendaya' }] },
  videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc123' }] }, external_ids: { imdb_id: 'tt1160419' },
  'watch/providers': { results: { FR: { flatrate: [{ provider_name: 'Netflix' }], rent: [{ provider_name: 'Orange VOD' }], link: 'https://justwatch.test' } } },
});

function setup(over = {}) {
  const sent = [];
  const bot = {
    sendMessage: async (to, text, o) => sent.push({ kind: 'dm', to, text, o }),
    sendGroupMessage: async (groupId, text, o) => sent.push({ kind: 'group', groupId, text, o }),
    send: async (body) => sent.push({ kind: 'raw', body }),
    sendChatAction: async () => {},
    editMessage: async (target, msgId, patch) => sent.push({ kind: 'edit', target, msgId, patch }),
  };
  const tmdb = {
    searchMovie: async () => [DUNE],
    searchPerson: async () => [{ id: 9 }],
    movie: async (id) => movieFull(id, 'Dune'),
    person: async () => ({ name: 'Zendaya', birthday: '1996-09-01', biography: 'Actrice.', movie_credits: { cast: [{ id: 1, title: 'Dune', vote_count: 9000, popularity: 90 }] } }),
    trending: async () => [DUNE],
    upcoming: async () => [DUNE],
    similar: async () => [{ ...DUNE, id: 2, title: 'Arrival' }],
    discover: async () => [1, 2, 3, 4].map((i) => ({ ...DUNE, id: i, title: `Film ${i}`, overview: `Film ${i} raconte une histoire assez longue pour servir d'indice au quiz du bot.` })),
    ...over.tmdb,
  };
  const omdb = over.omdb === undefined ? { byImdbId: async () => ({ imdbRating: '8.0', rottenTomatoes: '83%', metascore: '74', awards: 'Won 6 Oscars' }) } : over.omdb;
  const store = new Store(null);
  const h = createHandler({ bot, tmdb, omdb, store, button, random: () => 0.1, now: over.now });
  const dm = (text, from = 'u1') => h.handle({ type: 'message.received', data: { from, chatId: from, type: 'text', textMsg: text } });
  return { sent, dm, h, store };
}

test('parseCommand : commandes, suffixe @bot, texte libre', () => {
  assert.deepEqual(parseCommand('/film Black Panther'), { name: 'movie', arg: 'Black Panther' });
  assert.deepEqual(parseCommand('/FILM@bot_aTY4UTzr Dune'), { name: 'movie', arg: 'Dune' });
  assert.deepEqual(parseCommand('/ou_voir Dune'), { name: 'where', arg: 'Dune' });
  assert.deepEqual(parseCommand('Dune'), { name: 'free', arg: 'Dune' });
  assert.equal(parseCommand('/zzz').name, 'unknown');
  assert.equal(parseCommand(''), null);
});

test('/film : fiche avec affiche, notes IMDb/RT, réalisateur et boutons', async () => {
  const { sent, dm } = setup();
  await dm('/film dune');
  const raw = sent.find((s) => s.kind === 'raw').body;
  assert.equal(raw.type, 'image');
  assert.equal(raw.to, 'u1');
  assert.match(raw.fileUrl, /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/p\.jpg$/);
  assert.match(raw.caption, /IMDb 8\.0\/10/);
  assert.match(raw.caption, /🍅 83%/);
  assert.match(raw.caption, /Denis Villeneuve/);
  assert.ok(raw.caption.length <= 1024);
  const flat = raw.buttons.flat();
  assert.ok(flat.some((b) => b.callbackData === 'w:1'));
  assert.ok(flat.some((b) => b.url === 'https://www.youtube.com/watch?v=abc123'));
});

test('/film sans OMDb : la fiche reste disponible (note TMDB)', async () => {
  const { sent, dm } = setup({ omdb: null });
  await dm('/film dune');
  const c = sent.find((s) => s.kind === 'raw').body.caption;
  assert.match(c, /TMDB 7\.8/);
  assert.doesNotMatch(c, /IMDb/);
});

test('titre ambigu : liste de choix en boutons', async () => {
  const { sent, dm } = setup({ tmdb: { searchMovie: async () => [DUNE, { ...DUNE, id: 5, title: 'Dune 2' }] } });
  await dm('/film dun');
  const m = sent.find((s) => s.kind === 'dm');
  assert.match(m.text, /Plusieurs résultats/);
  assert.equal(m.o.buttons[0][0].callbackData, 'm:1');
});

test("aucun résultat et message d'aide", async () => {
  const { sent, dm } = setup({ tmdb: { searchMovie: async () => [] } });
  await dm('/film xyzxyz');
  assert.match(sent[0].text, /Aucun résultat/);
  await dm('/film');
  assert.match(sent[1].text, /Quel film/);
});

test('texte libre en message privé = recherche de film', async () => {
  const { sent, dm } = setup();
  await dm('Dune');
  assert.ok(sent.some((s) => s.kind === 'raw'));
});

test('en groupe : réponse aux commandes ou aux mentions seulement', async () => {
  const { sent, h } = setup();
  const g = (textMsg, isMentioned = false) => h.handle({ type: 'group_message.received', data: { from: 'u1', groupId: 'G1', type: 'text', textMsg, isMentioned } });
  await g('salut tout le monde');
  assert.equal(sent.length, 0);
  await g('/aide');
  assert.equal(sent[0].kind, 'group');
  assert.equal(sent[0].groupId, 'G1');
  await g('Dune', true);
  assert.ok(sent.some((s) => s.kind === 'raw' && s.body.groupId === 'G1'));
});

test('liste « à voir » : ajouter, doublon, lister, retirer', async () => {
  const { sent, dm } = setup();
  await dm('/ajouter Dune');
  assert.match(sent.at(-1).text, /ajouté/);
  await dm('/ajouter Dune');
  assert.match(sent.at(-1).text, /déjà/);
  await dm('/liste');
  assert.match(sent.at(-1).text, /1\. Dune \(2021\)/);
  await dm('/retirer 9');
  assert.match(sent.at(-1).text, /invalide/);
  await dm('/retirer 1');
  assert.match(sent.at(-1).text, /retiré/);
  await dm('/liste');
  assert.match(sent.at(-1).text, /vide/);
});

test('boutons : où voir (pays) et ajout depuis la fiche', async () => {
  const { sent, h } = setup();
  const cb = (data) => h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'M1', data } });
  await cb('w:1');
  assert.match(sent.at(-1).text, /Netflix/);
  assert.match(sent.at(-1).text, /Orange VOD/);
  await cb('a:1');
  assert.match(sent.at(-1).text, /ajouté/);
});

test('/pays et /langue : préférences et pays sans offre', async () => {
  const { sent, dm } = setup();
  await dm('/pays cm');
  assert.match(sent.at(-1).text, /CM/);
  await dm('/ou_voir dune');
  assert.match(sent.at(-1).text, /Aucune offre/);
  await dm('/langue en');
  assert.match(sent.at(-1).text, /English/);
  await dm('/help');
  assert.match(sent.at(-1).text, /Search/);
  await dm('/langue xx');
  assert.match(sent.at(-1).text, /Available languages/);
  await dm('/pays 12');
  assert.match(sent.at(-1).text, /country code/);
});

test('/hasard : genre connu, inconnu, et /comparer', async () => {
  const { sent, dm } = setup();
  await dm('/hasard thriller');
  assert.ok(sent.some((s) => s.kind === 'raw'));
  await dm('/hasard xyz');
  assert.match(sent.at(-1).text, /Genre inconnu/);
  await dm('/comparer Dune | Dune 2');
  assert.match(sent.at(-1).text, /vs/);
  await dm('/comparer Dune');
  assert.match(sent.at(-1).text, /Format/);
});

test('quiz : bonne réponse comptée, question expirée', async () => {
  const { sent, dm, h, store } = setup();
  await dm('/quiz');
  const q = sent.at(-1);
  assert.match(q.text, /Devine le film/);
  assert.equal(q.o.buttons.length, 4);
  const qid = q.o.buttons[0][0].callbackData.split(':')[1];
  // random() = 0.1 → la bonne réponse est à l'index 0
  await h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'Q1', data: `q:${qid}:0` } });
  assert.match(sent.at(-1).patch.content, /Bravo/);
  assert.equal(store.user('u1').quizWins, 1);
  await h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'Q1', data: `q:${qid}:0` } });
  assert.match(sent.at(-1).text, /expiré/);
});

test('erreur du service de données : message poli, pas de plantage', async () => {
  const { sent, dm } = setup({ tmdb: { searchMovie: async () => { throw new Error('TMDB 500'); } } });
  await dm('/film dune');
  assert.match(sent.at(-1).text, /momentanément indisponible/);
});

test('messages non texte ignorés ; utilisateurs isolés', async () => {
  const { sent, h, dm, store } = setup();
  await h.handle({ type: 'message.received', data: { from: 'u1', chatId: 'u1', type: 'image', textMsg: '' } });
  assert.equal(sent.length, 0);
  await dm('/ajouter Dune', 'a');
  assert.equal(store.user('b').watchlist.length, 0);
});

test('format : genres, masquage du titre, plafond de légende', () => {
  assert.equal(F.genreId('Comédie'), 35);
  assert.equal(F.genreId('Science-Fiction'), 878);
  assert.equal(F.genreId('nope'), null);
  assert.doesNotMatch(F.maskTitle('Dune est un désert. Paul visite Dune.', 'Dune'), /Dune/);
  const huge = { ...movieFull(1, 'X'), overview: 'a'.repeat(5000) };
  assert.ok(F.movieCard(huge, null, 'fr', button, 'FR').caption.length <= 1000);
});

test('client TMDB : en-tête Bearer, cache, erreur HTTP', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, auth: opts.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ results: [DUNE] }) };
  };
  const api = new Tmdb({ token: 'TOK', fetchImpl });
  assert.equal((await api.searchMovie('dune', 'fr-FR')).length, 1);
  await api.searchMovie('dune', 'fr-FR');
  assert.equal(calls.length, 1, 'la 2e requête vient du cache');
  assert.equal(calls[0].auth, 'Bearer TOK');
  assert.match(calls[0].url, /query=dune/);
  const bad = new Tmdb({ token: 'T', fetchImpl: async () => ({ ok: false, status: 429 }) });
  await assert.rejects(() => bad.trending('fr-FR'), /TMDB 429/);
  assert.throws(() => new Tmdb({}), /TMDB_TOKEN/);
});

test('client OMDb : notes, identifiant invalide, panne = null', async () => {
  const good = new Omdb({ apiKey: 'K', fetchImpl: async () => ({ ok: true, json: async () => ({ Response: 'True', imdbRating: '8.0', Ratings: [{ Source: 'Rotten Tomatoes', Value: '83%' }], Metascore: 'N/A' }) }) });
  assert.deepEqual(await good.byImdbId('tt1'), { imdbRating: '8.0', imdbVotes: null, metascore: null, rottenTomatoes: '83%', awards: null });
  assert.equal(await good.byImdbId('pas-un-id'), null);
  const down = new Omdb({ apiKey: 'K', fetchImpl: async () => { throw new Error('réseau'); } });
  assert.equal(await down.byImdbId('tt2'), null);
  assert.equal(await new Omdb({ apiKey: '' }).byImdbId('tt3'), null);
});

test('aide : sections courtes et boutons d\'accès rapide qui déclenchent les commandes', async () => {
  const { sent, dm, h } = setup();
  await dm('/aide');
  const m = sent.at(-1);
  assert.match(m.text, /🔎 \*\*Chercher\*\*/);
  assert.doesNotMatch(m.text, /•/);
  assert.deepEqual(m.o.buttons.flat().map((b) => b.callbackData), ['x:mood', 'x:trending', 'x:random', 'x:quiz', 'x:list']);
  await h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'H1', data: 'x:trending' } });
  assert.match(sent.at(-1).text, /Tendances/);
  await h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'H1', data: 'x:inconnu' } });
});

test('« écrit… » ne retarde pas la réponse', async () => {
  const { sent, h } = setup();
  let release;
  const slow = new Promise((r) => { release = r; });
  const bot2 = { sendMessage: async (to, text, o) => sent.push({ to, text, o }), send: async (b) => sent.push({ kind: 'raw', body: b }), sendChatAction: () => slow };
  const { createHandler: ch } = require('../src/handlers');
  const { Store: S2 } = require('../src/store');
  const fast = ch({ bot: bot2, tmdb: { searchMovie: async () => [] }, omdb: null, store: new S2(null), button });
  await fast.handle({ type: 'message.received', data: { from: 'u9', chatId: 'u9', type: 'text', textMsg: '/aide' } });
  assert.match(sent.at(-1).text, /Kurosu/);
  release();
  void h;
});

// ——— Envies (reprises de Kurosu) ———
const E = require('../src/envies');

function setupEnvies(results) {
  const calls = [];
  const s = setup({ tmdb: { discover: async (p) => { calls.push(p); return results; } } });
  return { ...s, calls };
}
const FILMS = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, title: `Film ${i}`, release_date: '2020-01-01', vote_average: 7, genre_ids: [35], original_language: 'fr' }));
const cb = (h, data) => h.handle({ type: 'callback.received', data: { from: 'u1', chatId: 'u1', msgId: 'M1', data } });

test('envies : recherche par clé, nom FR/EN ou « 2h »', () => {
  assert.equal(E.trouverEnvie('rire').cle, 'rire');
  assert.equal(E.trouverEnvie('Rigoler').cle, 'rire');
  assert.equal(E.trouverEnvie('laugh').cle, 'rire');
  assert.equal(E.trouverEnvie('ÉVASION').cle, 'evasion');
  assert.equal(E.trouverEnvie('cerveau retourné').cle, 'cerveau');
  assert.equal(E.trouverEnvie("j'ai 2 h").cle, 'deuxHeures');
  assert.equal(E.trouverEnvie('2h').cle, 'deuxHeures');
  assert.equal(E.trouverEnvie('sport'), null); // pas de réglage film dans Kurosu
  assert.equal(E.trouverEnvie(''), null);
  assert.equal(parseCommand('/envie frissons').name, 'mood');
  assert.equal(parseCommand('/mood chills').name, 'mood');
});

test('envies : paramètres TMDB identiques à Kurosu', () => {
  const p = E.parametresDiscover(E.envie('emotion'), { language: 'fr-FR', page: 2 });
  assert.equal(p.with_genres, 18);
  assert.equal(p.sort_by, 'vote_average.desc');
  assert.equal(p['vote_count.gte'], 1000);
  assert.equal(p.page, 2);
  const t2 = E.parametresDiscover(E.envie('deuxHeures'), { language: 'fr-FR' });
  assert.equal(t2.with_genres, undefined);
  assert.equal(t2['with_runtime.lte'], 120);
  assert.equal(t2['with_runtime.gte'], 40);
  assert.equal(E.parametresDiscover(E.envie('rire'), {}).sort_by, 'popularity.desc');
});

test('envies : les boutons respectent les limites GPChat', () => {
  for (const lang of ['fr', 'en']) {
    const rows = E.boutonsEnvies(lang, button);
    assert.ok(rows.length <= 5);
    assert.ok(rows.every((r) => r.length <= 4));
    const flat = rows.flat();
    assert.equal(flat.length, E.ENVIES.length);
    assert.ok(flat.every((b) => b.text.length <= 32 && /^[\w\-:.|/=+#@]{1,64}$/.test(b.callbackData)));
  }
});

test('/envie sans argument : menu des envies', async () => {
  const { sent, dm } = setupEnvies(FILMS);
  await dm('/envie');
  const m = sent.at(-1);
  assert.match(m.text, /envie de quoi/);
  assert.ok(m.o.buttons.flat().some((b) => b.callbackData === 'e:frissons'));
});

test('/envie inconnue : message et menu', async () => {
  const { sent, dm, calls } = setupEnvies(FILMS);
  await dm('/envie zzz');
  assert.match(sent.at(-1).text, /« zzz » inconnue/);
  assert.equal(calls.length, 0);
});

test('/envie rigoler : 8 films, 4 fiches, « Autres idées » vers la page 2', async () => {
  const { sent, dm, calls } = setupEnvies(FILMS);
  await dm('/envie rigoler');
  assert.equal(calls[0].with_genres, 35);
  assert.equal(calls[0].page, 1);
  const m = sent.at(-1);
  assert.match(m.text, /😂 Rigoler/);
  assert.match(m.text, /8\. Film 7/);
  assert.doesNotMatch(m.text, /9\. Film 8/);
  const rows = m.o.buttons;
  assert.ok(rows.length <= 5);
  assert.deepEqual(rows.slice(0, 4).map((r) => r[0].callbackData), ['m:100', 'm:101', 'm:102', 'm:103']);
  assert.deepEqual(rows.at(-1).map((b) => b.callbackData), ['e:rire:2', 'e:menu']);
});

test('envies : l\'animation japonaise est écartée (catalogue anime de Kurosu)', async () => {
  const anime = { id: 999, title: 'Your Name', original_language: 'ja', genre_ids: [16, 10749] };
  const { sent, dm } = setupEnvies([anime, ...FILMS.slice(0, 2)]);
  await dm('/envie romance');
  assert.doesNotMatch(sent.at(-1).text, /Your Name/);
  assert.match(sent.at(-1).text, /Film 0/);
});

test('envies : boutons (menu, page suivante, retour au début, envie inconnue)', async () => {
  const { sent, h, calls } = setupEnvies(FILMS);
  await cb(h, 'x:mood');
  assert.match(sent.at(-1).text, /envie de quoi/);
  await cb(h, 'e:frissons');
  assert.equal(calls.at(-1).with_genres, 27);
  await cb(h, 'e:frissons:3');
  assert.equal(calls.at(-1).page, 3);
  assert.deepEqual(sent.at(-1).o.buttons.at(-1)[0].callbackData, 'e:frissons:4');
  await cb(h, `e:frissons:${E.PAGES_MAX}`);
  assert.equal(sent.at(-1).o.buttons.at(-1)[0].callbackData, 'e:frissons:1');
  await cb(h, 'e:frissons:999');
  assert.equal(calls.at(-1).page, 1);
  await cb(h, 'e:menu');
  assert.match(sent.at(-1).text, /envie de quoi/);
  const n = sent.length;
  await cb(h, 'e:inexistante');
  assert.equal(sent.length, n);
});

test('envies : aucun résultat et anglais', async () => {
  const { sent, dm, store } = setupEnvies([]);
  store.user('u1').lang = 'en';
  await dm('/mood chills');
  assert.match(sent.at(-1).text, /No result for "Chills"/);
});
