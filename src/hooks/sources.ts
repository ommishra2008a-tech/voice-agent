/**
 * Media Source Asset Lifecycle Hooks
 */
export async function onBeforeSourceAssetCreate(record: Record<string, any>, context: any) {
  const allowedTypes = ["audio_upload", "video_upload", "microphone", "url", "youtube"];
  if (!allowedTypes.includes(record.sourceType)) {
    throw new Error(`Invalid sourceType "${record.sourceType}". Allowed: ${allowedTypes.join(", ")}`);
  }
  if (!record.status) {
    record.status = "uploaded";
  }
  return record;
}

export async function onAfterSourceAssetCreate(record: Record<string, any>, context: any) {
  console.log(`[HOOK] Source Asset registered: ${record.id} (${record.format}, duration: ${record.duration}s)`);
  return record;
}
