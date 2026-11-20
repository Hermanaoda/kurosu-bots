# Kurosu (`@bot_aTY4UTzr`)

Le bot GPChat de [Kurosu](https://github.com/Hermanaoda/kurosu) : **que regarder ce soir, selon l'envie**. Dérivé de **Ciné Club** (`bots/cinema`, licence MIT), dont il garde toutes les fonctions : fiches de films avec affiche, notes **IMDb / Rotten Tomatoes / Metacritic**, acteurs, tendances, sorties, **où regarder** (streaming par pays), comparaison, quiz et liste « à voir ». Français et anglais.

## Envies
`/envie` ouvre un menu de boutons ; `/envie rigoler` (ou `/mood laugh`) donne directement les films.

| Envie | Filtre TMDB (`/discover/movie`) |
|---|---|
| 😂 Rigoler | Comédie |
| 💕 Romance | Romance |
| 😱 Frissons | Horreur |
| 🔥 Adrénaline | Action |
| 😢 Émotion | Drame, mieux notés (≥ 1 000 votes) |
| 🤯 Cerveau retourné | Mystère, mieux notés (≥ 1 000 votes) |
| 🕵️ Enquête | Crime |
| 🌌 Évasion | Fantastique |
| ☕ Doux | Familial |
| ⏱ J'ai 2 h | Durée entre 40 et 120 min |

Mêmes réglages que les ambiances de Kurosu (`web/src/lib/ambiances.js`), sans IA. Chaque envie affiche 8 films (popularité, ≥ 100 votes, sauf tri par note), 4 boutons de fiche et « 🔀 Autres idées » (pages 1 à 5, puis retour au début). L'animation japonaise est écartée : elle relève du catalogue anime. Le code est dans `src/envies.js`.

## Commandes
`/envie`, `/film`, `/acteur`, `/tendances`, `/bientot`, `/hasard [genre]`, `/ou_voir`, `/similaires`, `/comparer A | B`, `/liste`, `/ajouter`, `/retirer n`, `/quiz`, `/langue fr|en`, `/pays CM`, `/aide`, `/apropos`.
Envoyer simplement un titre en message privé lance aussi une recherche. En groupe, le bot ne répond qu'aux commandes ou quand on le mentionne.

## Données
- **TMDB** (obligatoire) — fiches, casting, affiches, streaming. Jeton « Read Access Token » gratuit. *This product uses the TMDB API but is not endorsed or certified by TMDB.* Vérifiez leurs conditions pour un usage commercial.
- **OMDb** (facultatif) — notes IMDb / Rotten Tomatoes / Metacritic. IMDb n'offre pas d'API gratuite : OMDb est le relais le plus simple (clé gratuite limitée à ~1 000 requêtes/jour).
- Streaming : JustWatch via TMDB.

## Lancer
```bash
cd bots/kurosu && npm install
GPCHAT_API_KEY=gpk_live_… TMDB_TOKEN=… OMDB_API_KEY=… npm start
npm test        # tests sans réseau
```
Un cache mémoire (10 min TMDB, 1 h OMDb) limite les appels. Préférences et listes : `DATA_DIR/kurosu.json`.

## Exploitation

| Variable | Défaut | Rôle |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` · `info` · `warn` · `error` — journaux JSON en production |
| `OPS_PORT` / `OPS_HOST` | `9100` / `127.0.0.1` | serveur d'exploitation : `/healthz` (vivant), `/readyz` (opérationnel, 503 sinon), `/metrics` (Prometheus) |
| `DATA_DIR` | `./data` | état persistant (écriture atomique) — à sauvegarder |

- **Journaux, métriques, alertes recommandées, dépannage** : [docs/OPERATIONS.md](../../docs/OPERATIONS.md).
- **Version et changelog** : [CHANGELOG.md](CHANGELOG.md) · politique : [docs/VERSIONING.md](../../docs/VERSIONING.md). La version déployée est dans le journal de démarrage et la métrique `gpchat_bot_info`.
- **Alertes côté GPChat** : renseignez un e-mail et/ou un webhook Slack/Discord d'alerte dans la console (*Paramètres*) : GPChat prévient le créateur d'un bot en polling qui ne vient plus chercher ses messages (10 min), d'un webhook en panne (24 h), d'événements abandonnés et de signalements.
