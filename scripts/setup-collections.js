const BASE_URL = "http://localhost:8090";

const collectionsToCreate = [
  {
    name: "projects",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "userId", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "settings", type: "json" }
    ]
  },
  {
    name: "source_assets",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "projectId", type: "text", required: true },
      { name: "userId", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "sourceType", type: "text", required: true },
      { name: "sourceUrl", type: "text" },
      { name: "file", type: "file" },
      { name: "mediaType", type: "text", required: true },
      { name: "format", type: "text", required: true },
      { name: "duration", type: "number" },
      { name: "sampleRate", type: "number" },
      { name: "channels", type: "number" },
      { name: "status", type: "text" },
      { name: "metadata", type: "json" }
    ]
  },
  {
    name: "transcripts",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "sourceAssetId", type: "text", required: true },
      { name: "projectId", type: "text", required: true },
      { name: "userId", type: "text", required: true },
      { name: "language", type: "text", required: true },
      { name: "fullText", type: "text", required: true },
      { name: "segments", type: "json" },
      { name: "speakerCount", type: "number" },
      { name: "confidence", type: "number" }
    ]
  },
  {
    name: "voice_profiles",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "projectId", type: "text", required: true },
      { name: "userId", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "speakerId", type: "text" },
      { name: "sourceAssetId", type: "text" },
      { name: "speakerEmbedding", type: "json", required: true },
      { name: "timbreCharacteristics", type: "json" },
      { name: "pitchStats", type: "json" },
      { name: "prosodyProfile", type: "json" },
      { name: "styleProfile", type: "json" },
      { name: "emotionProfile", type: "json" },
      { name: "referenceAudio", type: "file" }
    ]
  },
  {
    name: "generation_jobs",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "projectId", type: "text", required: true },
      { name: "userId", type: "text", required: true },
      { name: "voiceProfileId", type: "text", required: true },
      { name: "text", type: "text", required: true },
      { name: "targetLanguage", type: "text" },
      { name: "styleParams", type: "json" },
      { name: "emotionParam", type: "text" },
      { name: "status", type: "text" },
      { name: "progress", type: "number" },
      { name: "outputAssetId", type: "text" },
      { name: "error", type: "text" },
      { name: "executionTimeMs", type: "number" }
    ]
  },
  {
    name: "generated_assets",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "jobId", type: "text", required: true },
      { name: "projectId", type: "text", required: true },
      { name: "userId", type: "text", required: true },
      { name: "voiceProfileId", type: "text", required: true },
      { name: "file", type: "file" },
      { name: "duration", type: "number" },
      { name: "format", type: "text" },
      { name: "sampleRate", type: "number" },
      { name: "qualityScore", type: "number" },
      { name: "metadata", type: "json" }
    ]
  },
  {
    name: "vectors",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "documentId", type: "text", required: true },
      { name: "embedding", type: "json", required: true },
      { name: "metadata", type: "json" }
    ]
  }
];

async function setup() {
  const adminRes = await fetch(`${BASE_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "admin@voiceai.lab", password: "AdminPassword123!" })
  });
  const { token } = await adminRes.json();

  const existingRes = await fetch(`${BASE_URL}/api/collections`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const existing = await existingRes.json();
  const existingNames = new Set((existing.items || []).map(c => c.name));

  for (const c of collectionsToCreate) {
    if (existingNames.has(c.name)) {
      console.log(`Collection ${c.name} already exists.`);
      continue;
    }
    const res = await fetch(`${BASE_URL}/api/collections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(c)
    });
    if (res.status === 200 || res.status === 201) {
      console.log(`? Created collection: ${c.name}`);
    } else {
      console.error(`? Failed to create ${c.name}:`, res.status, await res.text());
    }
  }
}

setup().catch(console.error);
