module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      sourceUrl TEXT,
      filePath TEXT,
      mediaType TEXT NOT NULL,
      format TEXT NOT NULL,
      duration REAL DEFAULT 0,
      sampleRate INTEGER DEFAULT 0,
      channels INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'uploaded',
      metadata TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS source_assets`);
  }
};
