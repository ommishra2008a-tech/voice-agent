module.exports = {
  async up(app) {
    await app.db().execute(`
CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      speakerId TEXT,
      sourceAssetId TEXT,
      speakerEmbedding TEXT NOT NULL,
      timbreCharacteristics TEXT,
      pitchStats TEXT,
      prosodyProfile TEXT,
      styleProfile TEXT,
      emotionProfile TEXT,
      referenceAudioPath TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
`);
  },
  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS voice_profiles`);
  }
};
