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

  const formData = new FormData();
  formData.append("projectId", "proj_001");
  formData.append("userId", "user_001");
  formData.append("name", "speech_sample_01.wav");
  formData.append("sourceType", "audio_upload");
  formData.append("mediaType", "audio");
  formData.append("format", "wav");
  formData.append("duration", "1.0");
  formData.append("sampleRate", "16000");
  formData.append("channels", "1");
  formData.append("status", "uploaded");

  const fileBlob = new Blob([wavBuffer], { type: "audio/wav" });
  formData.append("file", fileBlob, "speech_sample_01.wav");

  const res = await fetch("http://localhost:8090/api/collections/source_assets/records", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + client.authStore.token
    },
    body: formData
  });

  const data = await res.json();
  console.log("Upload status:", res.status);
  console.log("Upload result:", JSON.stringify(data, null, 2));

  if (data.file) {
    const fileUrl = `http://localhost:8090/api/files/source_assets/${data.id}/${data.file}`;
    console.log("File URL:", fileUrl);
    const getRes = await fetch(fileUrl);
    console.log("File download status:", getRes.status, "Content-Length:", getRes.headers.get("content-length"));
  }
})();
