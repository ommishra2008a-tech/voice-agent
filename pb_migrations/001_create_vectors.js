module.exports = {
  async up(app) {
    await app.db().execute(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata TEXT,
        created TEXT NOT NULL,
        updated TEXT NOT NULL
      )
    `)
  },

  async down(app) {
    await app.db().execute(`DROP TABLE IF EXISTS vectors`)
  }
}
