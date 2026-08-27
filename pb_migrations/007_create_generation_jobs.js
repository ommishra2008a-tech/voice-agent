module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      voiceProfileId TEXT NOT NULL,
      text TEXT NOT NULL,
      targetLanguage TEXT DEFAULT 'en',
      styleParams TEXT,
      emotionParam TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      progress REAL DEFAULT 0,
      outputAssetId TEXT,
      error TEXT,
      executionTimeMs INTEGER DEFAULT 0,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS generation_jobs`);
  }
};
