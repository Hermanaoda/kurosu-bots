#!/usr/bin/env node
// Publie une version d'un bot : node scripts/release.mjs <bot> <correctif|mineur|majeur> [--dry-run]
//  1. vérifie l'arbre git propre et lance les tests du bot ;
//  2. incrémente la version (SemVer) dans bots/<bot>/package.json ;
//  3. transforme « ## [Non publié] » du CHANGELOG du bot en « ## [x.y.z] — date » (et recrée une section vide) ;
//  4. commit « chore(release): <bot> vx.y.z » + étiquette « <bot>-vx.y.z ».
// Ensuite : git push --follow-tags (le workflow release.yml construit l'image et crée la Release GitHub).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [bot, kind] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry-run');
const KINDS = { correctif: 'patch', patch: 'patch', mineur: 'minor', minor: 'minor', majeur: 'major', major: 'major' };

const dir = bot === 'ops' ? 'packages/ops' : `bots/${bot}`;
if (!bot || !KINDS[kind] || !fs.existsSync(path.join(ROOT, dir, 'package.json'))) {
  console.error('Usage : node scripts/release.mjs <cinema|kurosu|devfest|dev-alerts|reminders|football|ops> <correctif|mineur|majeur> [--dry-run]');
  process.exit(2);
}
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkgPath = path.join(ROOT, dir, 'package.json');
const clPath = path.join(ROOT, dir, 'CHANGELOG.md');

if (git('status', '--porcelain')) throw new Error('Arbre git non propre : commitez ou rangez vos changements avant de publier.');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [M, m, p] = pkg.version.split('.').map(Number);
const next = { major: `${M + 1}.0.0`, minor: `${M}.${m + 1}.0`, patch: `${M}.${m}.${p + 1}` }[KINDS[kind]];

const changelog = fs.readFileSync(clPath, 'utf8').replace(/\r\n/g, '\n');
const unreleased = /## \[Non publié\]\n([\s\S]*?)(?=\n## \[)/.exec(changelog);
if (!unreleased || !unreleased[1].trim()) throw new Error(`Rien sous « ## [Non publié] » dans ${dir}/CHANGELOG.md : décrivez les changements d'abord.`);

const date = new Date().toISOString().slice(0, 10);
console.log(`${bot} ${pkg.version} → ${next} (${kind}) — ${date}`);
if (DRY) {
  console.log(unreleased[1].trim());
  process.exit(0);
}

console.log('Tests…');
execFileSync('npm', ['test'], { cwd: path.join(ROOT, dir), stdio: 'inherit', shell: process.platform === 'win32' });

pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
fs.writeFileSync(clPath, changelog.replace('## [Non publié]\n', `## [Non publié]\n\n## [${next}] — ${date}\n`));

const tag = `${bot}-v${next}`;
git('add', pkgPath, clPath);
git('commit', '-m', `chore(release): ${bot} v${next}`);
git('tag', '-a', tag, '-m', `${bot} ${next}`);
console.log(`Version ${next} préparée. Publiez avec : git push --follow-tags   (étiquette ${tag})`);
