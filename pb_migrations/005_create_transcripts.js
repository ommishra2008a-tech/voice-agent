module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      sourceAssetId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      language TEXT NOT NULL,
      fullText TEXT NOT NULL,
      segments TEXT NOT NULL,
      speakerCount INTEGER DEFAULT 1,
      confidence REAL DEFAULT 1.0,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS transcripts`);
  }
};
