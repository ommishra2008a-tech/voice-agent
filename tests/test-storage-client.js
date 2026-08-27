const root = require("child_process").execSync("npm root -g").toString().trim();
const { SolarchClient } = require(root + "/solarch/packages/core-client/dist/index.cjs");

(async () => {
  const client = new SolarchClient("http://localhost:8090");
  await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + 1000, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(1000, 40);
  const pcmData = Buffer.alloc(1000);
  const wavBuffer = Buffer.concat([header, pcmData]);

  // Test JSON metadata creation first
  const record = await client.collection("source_assets").create({
    projectId: "proj_001",
    userId: "user_001",
    name: "speech_sample_01.wav",
    sourceType: "audio_upload",
    mediaType: "audio",
    format: "wav",
    duration: 1.0,
    sampleRate: 16000,
    channels: 1,
    status: "uploaded"
  });

  console.log("Source Asset Created:", record.id, record.name);
})();
