'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {normalize, exportFiles, slug} = require('./core.cjs');
class Store {
  constructor(root) { this.root = root; }
  async init() { await fs.mkdir(this.root, {recursive: true, mode: 0o700}); }
  async save(input) {
    const s = normalize(input); await this.init();
    const revision = `${Date.now()}-${randomUUID()}`;
    const dir = path.join(this.root, s.id); await fs.mkdir(dir, {recursive: true, mode: 0o700});
    await fs.writeFile(path.join(dir, `${revision}.json`), JSON.stringify(s, null, 2), {mode: 0o600, flag: 'wx'});
    return {id: s.id, revision};
  }
  async list() {
    await this.init(); const result = [];
    for (const entry of await fs.readdir(this.root, {withFileTypes: true})) {
      if (!entry.isDirectory() || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.name)) continue;
      const history = await this.history(entry.name);
      if (history.length) {const s = await this.load(entry.name, history[0]); result.push({id: s.id, title: s.title, createdAt: s.createdAt, steps: s.steps.length, revision: history[0]});}
    }
    return result.sort((a, b) => b.revision.localeCompare(a.revision));
  }
  dir(id) { if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw Error('Invalid session identifier.'); return path.join(this.root, id); }
  async history(id) { try {return (await fs.readdir(this.dir(id))).filter(x => /^\d+-[a-f0-9-]+\.json$/.test(x)).sort().reverse();} catch (e) {if (e.code === 'ENOENT') return []; throw e;} }
  async load(id, revision) {const files = await this.history(id); const name = revision || files[0]; if (!name || !files.includes(name)) throw Error('Revision not found.'); return normalize(JSON.parse(await fs.readFile(path.join(this.dir(id), name), 'utf8')));}
  async delete(id) { await fs.rm(this.dir(id), {recursive: true, force: true}); }
  async export(input, target, folder) {
    const files = exportFiles(input, target), out = path.join(folder, `skillforge-${slug(input.title)}-${randomUUID().slice(0,8)}`);
    await fs.mkdir(out, {mode: 0o700});
    for (const [file, content] of Object.entries(files)) {const full = path.join(out, file); await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, content, {mode: 0o600, flag: 'wx'});}
    return out;
  }
}
module.exports = {Store};
