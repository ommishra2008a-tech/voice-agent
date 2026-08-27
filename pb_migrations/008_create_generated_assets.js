module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS generated_assets (
      id TEXT PRIMARY KEY,
      jobId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      voiceProfileId TEXT NOT NULL,
      filePath TEXT NOT NULL,
      duration REAL NOT NULL,
      format TEXT NOT NULL DEFAULT 'wav',
      sampleRate INTEGER DEFAULT 24000,
      qualityScore REAL,
      metadata TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS generated_assets`);
  }
};
