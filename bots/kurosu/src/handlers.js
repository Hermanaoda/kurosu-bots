'use strict';
const { t } = require('./i18n');
const F = require('./format');
const { Tmdb } = require('./tmdb');
const E = require('./envies');

const COMMANDS = {
  start: 'start', aide: 'help', help: 'help',
  film: 'movie', movie: 'movie', acteur: 'person', actrice: 'person', actor: 'person', actress: 'person',
  tendances: 'trending', trending: 'trending', bientot: 'upcoming', upcoming: 'upcoming',
  hasard: 'random', random: 'random', ou_voir: 'where', where: 'where', similaires: 'similar', similar: 'similar',
  comparer: 'compare', compare: 'compare', liste: 'list', list: 'list', ajouter: 'add', add: 'add', retirer: 'remove', remove: 'remove',
  envie: 'mood', envies: 'mood', mood: 'mood', moods: 'mood',
  quiz: 'quiz', langue: 'lang', lang: 'lang', pays: 'country', country: 'country', apropos: 'about', about: 'about',
};

/** « /film@bot_aTY4UTzr Dune » → { name: 'movie', arg: 'Dune' } ; texte libre → { name: 'movie', arg: texte }. */
function parseCommand(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (!s.startsWith('/')) return { name: 'free', arg: s };
  const m = /^\/([a-zA-Z_]+)(?:@\w+)?\s*([\s\S]*)$/.exec(s);
  if (!m) return null;
  return { name: COMMANDS[m[1].toLowerCase()] || 'unknown', arg: m[2].trim() };
}

function createHandler({ bot, tmdb, omdb, store, button, random = Math.random, now = Date.now, log = { error() {}, warn() {} } }) {
  const quizzes = new Map(); // qid -> { correct, title, expires }

  const target = (c) => (c.groupId ? { groupId: c.groupId } : { to: c.to });
  const prefsOf = (userId) => store.user(userId);
  const L = (userId) => prefsOf(userId).lang;

  async function say(c, text, opts = {}) {
    if (c.groupId) return bot.sendGroupMessage(c.groupId, text, { markdown: true, ...opts });
    return bot.sendMessage(c.to, text, { markdown: true, ...opts });
  }
  async function card(c, k) {
    if (k.poster) {
      try { return await bot.send({ ...target(c), type: 'image', fileUrl: k.poster, caption: k.caption, buttons: k.buttons }); } catch { /* affiche refusée : repli texte */ }
    }
    return say(c, k.caption, { markdown: false, buttons: k.buttons });
  }

  async function findMovie(query, lang) {
    const results = await tmdb.searchMovie(query, lang === 'en' ? 'en-US' : 'fr-FR');
    return results;
  }
  const loc = (lang) => (lang === 'en' ? 'en-US' : 'fr-FR');

  async function showMovie(c, id, userId) {
    const lang = L(userId);
    const movie = await tmdb.movie(id, loc(lang));
    const omdb_ = omdb ? await omdb.byImdbId(movie.external_ids && movie.external_ids.imdb_id) : null;
    return card(c, F.movieCard(movie, omdb_, lang, button, prefsOf(userId).country));
  }

  async function searchAndShow(c, userId, query) {
    const lang = L(userId);
    if (!query) return say(c, t(lang, 'askTitle'));
    const results = await findMovie(query, lang);
    if (!results.length) return say(c, t(lang, 'noResult', { q: query }));
    const exact = results.filter((r) => F.norm(r.title) === F.norm(query));
    if (results.length === 1 || exact.length === 1) return showMovie(c, (exact[0] || results[0]).id, userId);
    return say(c, t(lang, 'pick', { q: query }), { buttons: F.pickButtons(results, button) });
  }

  const quickButtons = (lang) => [
    [button.callback(t(lang, 'btnMoods'), 'x:mood')],
    [button.callback(t(lang, 'btnTrending'), 'x:trending'), button.callback(t(lang, 'btnRandom'), 'x:random')],
    [button.callback(t(lang, 'btnQuiz'), 'x:quiz'), button.callback(t(lang, 'btnMyList'), 'x:list')],
  ];

  const listMessage = (lang, head, movies) => `${head}\n\n${movies.slice(0, 10).map((m, i) => F.listLine(m, i, lang)).join('\n')}`;

  async function commands(c, userId, cmd) {
    const u = prefsOf(userId);
    const lang = u.lang;
    switch (cmd.name) {
      case 'start': return say(c, t(lang, 'welcome'), { buttons: quickButtons(lang) });
      case 'help': return say(c, t(lang, 'help'), { buttons: quickButtons(lang) });
      case 'about': return say(c, t(lang, 'about'), { markdown: false });
      case 'free':
      case 'movie': return searchAndShow(c, userId, cmd.arg);
      case 'person': {
        if (!cmd.arg) return say(c, t(lang, 'askPerson'));
        const found = await tmdb.searchPerson(cmd.arg, loc(lang));
        if (!found.length) return say(c, t(lang, 'noResult', { q: cmd.arg }));
        const person = await tmdb.person(found[0].id, loc(lang));
        return card(c, F.personCard(person, lang, button));
      }
      case 'trending': {
        const list = await tmdb.trending(loc(lang));
        return say(c, listMessage(lang, t(lang, 'trending'), list), { buttons: F.pickButtons(list, button) });
      }
      case 'upcoming': {
        const list = await tmdb.upcoming(loc(lang), u.country);
        return say(c, listMessage(lang, t(lang, 'upcoming'), list), { buttons: F.pickButtons(list, button) });
      }
      case 'random': {
        let genre = null;
        if (cmd.arg) {
          genre = F.genreId(cmd.arg);
          if (genre == null) return say(c, t(lang, 'unknownGenre', { list: F.genreList().join(', ') }));
        }
        const pool = await tmdb.discover({ language: loc(lang), with_genres: genre || undefined, 'vote_count.gte': 300, page: 1 + Math.floor(random() * 5) });
        if (!pool.length) return say(c, t(lang, 'noResult', { q: cmd.arg || '…' }));
        const pick = pool[Math.floor(random() * pool.length)];
        await say(c, t(lang, 'randomPick'));
        return showMovie(c, pick.id, userId);
      }
      case 'where': {
        if (!cmd.arg) return say(c, t(lang, 'askTitle'));
        const [first] = await findMovie(cmd.arg, lang);
        if (!first) return say(c, t(lang, 'noResult', { q: cmd.arg }));
        return sendWhere(c, userId, first.id);
      }
      case 'similar': {
        if (!cmd.arg) return say(c, t(lang, 'askTitle'));
        const [first] = await findMovie(cmd.arg, lang);
        if (!first) return say(c, t(lang, 'noResult', { q: cmd.arg }));
        return sendSimilar(c, userId, first.id, first.title);
      }
      case 'compare': {
        const [a, b] = cmd.arg.split('|').map((x) => x.trim());
        if (!a || !b) return say(c, t(lang, 'askCompare'));
        const [ra, rb] = await Promise.all([findMovie(a, lang), findMovie(b, lang)]);
        if (!ra[0]) return say(c, t(lang, 'noResult', { q: a }));
        if (!rb[0]) return say(c, t(lang, 'noResult', { q: b }));
        const [ma, mb] = await Promise.all([tmdb.movie(ra[0].id, loc(lang)), tmdb.movie(rb[0].id, loc(lang))]);
        const [oa, ob] = omdb ? await Promise.all([omdb.byImdbId(ma.external_ids && ma.external_ids.imdb_id), omdb.byImdbId(mb.external_ids && mb.external_ids.imdb_id)]) : [null, null];
        return say(c, F.compareText(ma, mb, oa, ob, lang));
      }
      case 'list': return showList(c, userId);
      case 'add': {
        if (!cmd.arg) return say(c, t(lang, 'askTitle'));
        const [first] = await findMovie(cmd.arg, lang);
        if (!first) return say(c, t(lang, 'noResult', { q: cmd.arg }));
        return addToList(c, userId, first);
      }
      case 'remove': {
        const n = Number.parseInt(cmd.arg, 10);
        if (!Number.isInteger(n) || n < 1 || n > u.watchlist.length) return say(c, t(lang, 'badIndex'));
        const [gone] = u.watchlist.splice(n - 1, 1);
        store.save();
        return say(c, t(lang, 'removed', { title: gone.title }));
      }
      case 'mood': {
        if (!cmd.arg) return say(c, t(lang, 'moodsMenu'), { buttons: E.boutonsEnvies(lang, button) });
        const e = E.trouverEnvie(cmd.arg);
        if (!e) return say(c, t(lang, 'moodUnknown', { q: cmd.arg }), { buttons: E.boutonsEnvies(lang, button) });
        return showMood(c, userId, e, 1);
      }
      case 'quiz': return startQuiz(c, userId);
      case 'lang': {
        const v = cmd.arg.toLowerCase();
        if (v !== 'fr' && v !== 'en') return say(c, t(lang, 'langBad'));
        u.lang = v; store.save();
        return say(c, t(v, 'langSet'));
      }
      case 'country': {
        const v = cmd.arg.toUpperCase();
        if (!/^[A-Z]{2}$/.test(v)) return say(c, t(lang, 'countryBad'));
        u.country = v; store.save();
        return say(c, t(lang, 'countrySet', { country: v }));
      }
      default: return say(c, t(lang, 'unknownCmd'));
    }
  }

  async function sendWhere(c, userId, id) {
    const lang = L(userId);
    const movie = await tmdb.movie(id, loc(lang));
    return say(c, F.providersText(movie, prefsOf(userId).country, lang));
  }
  async function sendSimilar(c, userId, id, title) {
    const lang = L(userId);
    const list = (await tmdb.similar(id, loc(lang))).slice(0, 8);
    if (!list.length) return say(c, t(lang, 'noResult', { q: title }));
    return say(c, listMessage(lang, t(lang, 'similarTo', { title }), list), { buttons: F.pickButtons(list, button) });
  }
  /** Une envie : 8 films (sans animation japonaise, voir envies.js), 4 boutons de fiche, « Autres idées ». */
  async function showMood(c, userId, e, page) {
    const lang = L(userId);
    const list = (await tmdb.discover(E.parametresDiscover(e, { language: loc(lang), page }))).filter((m) => !E.estUnAnime(m)).slice(0, 8);
    if (!list.length) return say(c, t(lang, 'noResult', { q: E.nom(e, lang) }));
    const head = `**${E.libelle(e, lang)}**\n_${E.phrase(e, lang)}_`;
    return say(c, listMessage(lang, head, list), {
      buttons: [
        ...F.pickButtons(list.slice(0, 4), button),
        [button.callback(t(lang, 'btnMoreIdeas'), `e:${e.cle}:${E.pageSuivante(page)}`), button.callback(t(lang, 'btnOtherMoods'), 'e:menu')],
      ],
    });
  }

  async function showList(c, userId) {
    const u = prefsOf(userId);
    if (!u.watchlist.length) return say(c, t(u.lang, 'listEmpty'));
    const lines = u.watchlist.slice(0, 30).map((m, i) => `${i + 1}. ${m.title}${m.year ? ` (${m.year})` : ''}`);
    return say(c, `${t(u.lang, 'listTitle')}\n\n${lines.join('\n')}`);
  }
  async function addToList(c, userId, movie) {
    const u = prefsOf(userId);
    if (u.watchlist.some((m) => m.id === movie.id)) return say(c, t(u.lang, 'alreadyIn', { title: movie.title }));
    if (u.watchlist.length >= 100) u.watchlist.shift();
    u.watchlist.push({ id: movie.id, title: movie.title, year: F.year(movie.release_date) });
    store.save();
    return say(c, t(u.lang, 'added', { title: movie.title }));
  }

  async function startQuiz(c, userId) {
    const lang = L(userId);
    const page = 1 + Math.floor(random() * 10);
    const pool = (await tmdb.discover({ language: loc(lang), 'vote_count.gte': 2000, page })).filter((m) => m.overview && m.overview.length > 60);
    if (pool.length < 4) return say(c, t(lang, 'error'));
    const shuffled = [...pool].sort(() => random() - 0.5).slice(0, 4);
    const correct = Math.floor(random() * 4);
    const answer = shuffled[correct];
    const qid = Math.floor(random() * 1e8).toString(36);
    quizzes.set(qid, { correct, title: answer.title, expires: now() + 10 * 60 * 1000 });
    for (const [k, v] of quizzes) if (v.expires < now()) quizzes.delete(k);
    const genres = F.genreName(answer.genre_ids && answer.genre_ids[0], lang);
    const text = t(lang, 'quizIntro', { hint: F.maskTitle(answer.overview, answer.title), genre: genres, year: F.year(answer.release_date) });
    return say(c, text, { buttons: shuffled.map((m, i) => [button.callback(F.clip(m.title, 32), `q:${qid}:${i}`)]) });
  }

  async function callback(c, userId, data, msgId) {
    const lang = L(userId);
    const [kind, a, b] = String(data || '').split(':');
    if (kind === 'm') return showMovie(c, a, userId);
    if (kind === 'w') return sendWhere(c, userId, a);
    if (kind === 's') return sendSimilar(c, userId, a, '');
    if (kind === 'a') {
      const movie = await tmdb.movie(a, loc(lang));
      return addToList(c, userId, movie);
    }
    if (kind === 'q') {
      const q = quizzes.get(a);
      if (!q || q.expires < now()) return say(c, t(lang, 'quizExpired'));
      quizzes.delete(a);
      const ok = Number(b) === q.correct;
      const u = prefsOf(userId);
      if (ok) { u.quizWins += 1; store.save(); }
      const text = `${t(lang, ok ? 'quizRight' : 'quizWrong', { title: q.title })}\n${t(lang, 'quizScore', { n: u.quizWins })}`;
      try { await bot.editMessage(target(c), msgId, { content: text, buttons: [[button.callback(t(lang, 'quizAgain'), 'qn:0')]] }); } catch { await say(c, text); }
      return undefined;
    }
    if (kind === 'qn') return startQuiz(c, userId);
    if (kind === 'e') {
      if (a === 'menu') return say(c, t(lang, 'moodsMenu'), { buttons: E.boutonsEnvies(lang, button) });
      const e = E.envie(a);
      if (!e) return undefined; // envie retirée depuis l'envoi du message : on ignore
      const page = Number.parseInt(b, 10);
      return showMood(c, userId, e, Number.isInteger(page) && page >= 1 && page <= E.PAGES_MAX ? page : 1);
    }
    if (kind === 'x' && ['mood', 'trending', 'random', 'quiz', 'list'].includes(a)) return commands(c, userId, { name: a, arg: '' });
    return undefined;
  }

  /** Point d'entrée : une mise à jour GPChat (polling ou webhook). */
  async function handle(update) {
    const d = update.data || {};
    const userId = d.from;
    if (!userId) return;
    let c;
    try {
      if (update.type === 'message.received') {
        c = { to: d.chatId || d.from };
        const cmd = parseCommand(d.textMsg);
        if (!cmd || d.type !== 'text') return;
        bot.sendChatAction(c.to, 'typing', 3).catch(() => {}); // non attendu : l'appel ne rend la main qu'à la fin de l'animation
        await commands(c, userId, cmd);
      } else if (update.type === 'group_message.received') {
        c = { groupId: d.groupId };
        const cmd = parseCommand(d.textMsg);
        // En groupe, le bot ne répond qu'aux commandes ou quand on le mentionne (jamais à toute conversation).
        if (!cmd || d.type !== 'text' || (cmd.name === 'free' && !d.isMentioned)) return;
        await commands(c, userId, cmd);
      } else if (update.type === 'callback.received') {
        c = d.groupId ? { groupId: d.groupId } : { to: d.chatId || d.from };
        await callback(c, userId, d.data, d.msgId);
      }
    } catch (e) {
      if (c) await say(c, t(L(userId), 'error'), { markdown: false }).catch(() => {});
      log.error('échec de traitement', { type: update.type, error: e && e.message, status: e && e.status });
    }
  }

  return { handle, parseCommand };
}

module.exports = { createHandler, parseCommand, COMMANDS, Tmdb };
