# GPChat Bots — bibliothèque ouverte

Des bots GPChat **complets, testés et libres** (licence MIT), prêts à lancer ou à copier comme point de départ.
Open library of ready-to-run GPChat bots — fork them, run them, learn from them.

| Bot | @username | Ce qu'il fait | Hébergement type |
|---|---|---|---|
| [`bots/kurosu`](bots/kurosu) — **Kurosu** | `@bot_aTY4UTzr` | Ciné Club + les **envies** de Kurosu (😂 Rigoler, 😱 Frissons, 💕 Romance, ⏱ J'ai 2 h…) : des films en un clic, sans IA | Docker, polling |
| [`bots/cinema`](bots/cinema) — **Ciné Club** | `@cineclub_bot` | Fiches de films (affiche, notes IMDb / Rotten Tomatoes / Metacritic), acteurs, tendances, sorties, où regarder en streaming, comparaison, quiz, liste « à voir », FR/EN | Docker, polling |
| [`bots/devfest`](bots/devfest) — **DevFest Guide** | `@devfest_guide_bot` | Programme, session en cours / prochaine, rappels 10 min avant, vote du public, FAQ, annonces, FR/EN | Docker, polling |
| [`bots/dev-alerts`](bots/dev-alerts) — **Dev Alerts** | `@devalerts_bot` | GitHub, Uptime Kuma et webhooks JSON → groupe GPChat | Docker + HTTPS entrant |
| [`bots/reminders`](bots/reminders) — **Rappels** | `@rappels_bot` | Rappels en langage naturel FR/EN (« demain à 9h appeler maman », « tous les lundis à 8h »), récurrences, fuseau par personne, report en un clic, groupes | Docker, polling |
| [`bots/football`](bots/football) — **Foot en direct** | `@footdirect_bot` | Scores en direct, alertes à chaque but (buteur, minute), cartons rouges, mi-temps, fin de match ; calendrier, classements, buteurs ; CAN, CAF, Elite One, grands championnats ; FR/EN | Docker, polling, API-Football |
| [`_template`](_template) | — | Bot d'écho minimal à copier | — |

Le SDK Node.js officiel est inclus dans [`packages/sdk`](packages/sdk) (aucune dépendance).

## Démarrer en 5 minutes

```bash
git clone https://github.com/GPChat-Platform/bots && cd bots
npm run install:all && npm test           # tout est testé sans réseau
cp -r _template bots/mon-bot               # votre premier bot
```

1. **Créez le bot** : écrivez à **@gpchat_forge** → `/newbot` (ou la [console développeur](https://gpchat.app/developers/console)).
2. **Mode polling** : `/setmode polling` — aucun serveur public ni tunnel nécessaire, même en local.
3. Lancez `GPCHAT_API_KEY=gpk_live_… npm start` dans le dossier du bot.
4. Documentation de l'API : [FR](https://gpchat.app/developers/docs) · [EN](https://gpchat.app/en/developers/docs).

## Organisation d'un bot

```
bots/<nom>/
  bot.json        profil : nom, @username, catégorie, description, liste des commandes
  assets/         avatar.svg (source) et avatar.png (512×512)
  src/            logique (sans réseau, testable) + index.js (démarrage)
  test/           tests node:test, exécutés par la CI
  Dockerfile      construit depuis la racine du dépôt
  .env.example    variables d'environnement (jamais de secret dans le dépôt)
```

## Exploiter et faire évoluer

- [Journaux, supervision, alertes, dépannage](docs/OPERATIONS.md) — chaque bot expose `/healthz`, `/readyz`, `/metrics` et écrit des journaux JSON.
- [Versionnage et changelog](docs/VERSIONING.md) — SemVer par bot, `CHANGELOG.md`, `node scripts/release.mjs`, images GHCR.

## Déployer

Voir [`deploy/README.md`](deploy/README.md) (Docker Compose, reverse proxy, mise à jour, sauvegarde des données).

## Contribuer

Ajoutez votre bot en pull request : voir [CONTRIBUTING.md](CONTRIBUTING.md).
Règles de publication GPChat : un nom ou @username ne peut pas contenir *gpchat, forge, official, admin, verified…* ; la description doit faire au moins 20 caractères.

## Sources de données et mentions

Ciné Club utilise l'API TMDB (*This product uses the TMDB API but is not endorsed or certified by TMDB*), OMDb pour les notes IMDb / Rotten Tomatoes / Metacritic, et JustWatch (via TMDB) pour le streaming. Vérifiez les conditions d'usage de chaque fournisseur avant un usage commercial.

## Licence

MIT — voir [LICENSE](LICENSE).
