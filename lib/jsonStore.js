// lib/jsonStore.js
// Minimal file-based JSON array store. Good enough for low/medium traffic.
// Swap this out for a real database (Postgres, MongoDB, etc.) once traffic
// or team size justifies it — the read/write interface below is intentionally
// small so that swap is a one-file change.

const fs = require('fs/promises');
const path = require('path');

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this._queue = Promise.resolve(); // serializes writes to avoid race conditions
  }

  async _ensureFile() {
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, '[]', 'utf-8');
    }
  }

  async readAll() {
    await this._ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  // Runs synchronously with respect to other writes on this store instance.
  async append(record) {
    const run = this._queue.then(async () => {
      const all = await this.readAll();
      all.push(record);
      await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
      return record;
    });
    this._queue = run.catch(() => {}); // keep the chain alive even if one write fails
    return run;
  }

  async removeById(id) {
    const run = this._queue.then(async () => {
      const all = await this.readAll();
      const next = all.filter((r) => r.id !== id);
      const removed = next.length !== all.length;
      await fs.writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
      return removed;
    });
    this._queue = run.catch(() => {});
    return run;
  }

  async updateById(id, updates) {
    const run = this._queue.then(async () => {
      const all = await this.readAll();
      const index = all.findIndex((r) => r.id === id);
      if (index === -1) return null;
      all[index] = { ...all[index], ...updates };
      await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
      return all[index];
    });
    this._queue = run.catch(() => {});
    return run;
  }
}

module.exports = JsonStore;
