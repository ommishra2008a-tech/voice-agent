/**
 * Project Workspace Lifecycle Hooks
 */
export async function onBeforeProjectCreate(record: Record<string, any>, context: any) {
  if (!record.name || record.name.trim().length === 0) {
    throw new Error("Project name cannot be empty.");
  }
  if (!record.settings) {
    record.settings = {
      defaultLanguage: "en",
      defaultSampleRate: 24000,
      defaultEngine: "XTTSv2",
      createdVia: "VoiceAILab-API"
    };
  }
  return record;
}

export async function onAfterProjectCreate(record: Record<string, any>, context: any) {
  console.log(`[HOOK] Project created: ${record.id} ("${record.name}") for user ${record.userId}`);
  return record;
}
