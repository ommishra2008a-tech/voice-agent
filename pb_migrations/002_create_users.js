module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS users`);
  }
};
