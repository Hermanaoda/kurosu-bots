'use strict';
// Stockage minimal des préférences et listes « à voir » : un fichier JSON écrit de façon atomique.
// Suffisant pour quelques milliers d'utilisateurs ; remplacez par SQLite/Postgres si besoin (même interface).
const fs = require('node:fs');
const path = require('node:path');

class Store {
  constructor(file) {
    this.file = file; this.data = { users: {} }; this.timer = null;
    if (file && fs.existsSync(file)) {
      try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* fichier corrompu : on repart d'un état vide */ }
    }
    this.data.users = this.data.users || {};
  }

  user(id, defaults = {}) {
    if (!this.data.users[id]) this.data.users[id] = { lang: defaults.lang || 'fr', country: defaults.country || 'FR', watchlist: [], quizWins: 0 };
    return this.data.users[id];
  }

  save() {
    if (!this.file) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
    if (this.timer.unref) this.timer.unref();
  }

  flush() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
