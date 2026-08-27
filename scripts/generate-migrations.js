const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "pb_migrations");
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const list = [
  {
    file: "002_create_users.js",
    table: "users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )`
  },
  {
    file: "003_create_projects.js",
    table: "projects",
    sql: `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      settings TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )`
  },
  {
    file: "004_create_source_assets.js",
    table: "source_assets",
    sql: `CREATE TABLE IF NOT EXISTS source_assets (
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
    )`
  },
  {
    file: "005_create_transcripts.js",
    table: "transcripts",
    sql: `CREATE TABLE IF NOT EXISTS transcripts (
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
    )`
  },
  {
    file: "006_create_voice_profiles.js",
    table: "voice_profiles",
    sql: `CREATE TABLE IF NOT EXISTS voice_profiles (
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
    )`
  },
  {
    file: "007_create_generation_jobs.js",
    table: "generation_jobs",
    sql: `CREATE TABLE IF NOT EXISTS generation_jobs (
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
    )`
  },
  {
    file: "008_create_generated_assets.js",
    table: "generated_assets",
    sql: `CREATE TABLE IF NOT EXISTS generated_assets (
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
    )`
  }
];

if (!fs.existsSync("scripts")) fs.mkdirSync("scripts");

list.forEach(m => {
  const content = `module.exports = {
  async up(app) {
    await app.db().execute(\`\n${m.sql}\n\`);
  },
  async down(app) {
    await app.db().execute(\`DROP TABLE IF EXISTS ${m.table}\`);
  }
};
`;
  fs.writeFileSync(path.join(migrationsDir, m.file), content, "utf8");
  console.log("Created migration:", m.file);
});
