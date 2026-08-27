/**
 * Voice Generation Job Lifecycle Hooks & State Machine
 */
const VALID_STATUSES = ["PENDING", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

export async function onBeforeJobUpdate(current: Record<string, any>, next: Record<string, any>, context: any) {
  if (next.status && !VALID_STATUSES.includes(next.status)) {
    throw new Error(`Invalid status transition to "${next.status}". Allowed: ${VALID_STATUSES.join(", ")}`);
  }
  if (next.status === "COMPLETED") {
    next.progress = 100;
  }
  return next;
}

export async function onAfterJobUpdate(record: Record<string, any>, context: any) {
  console.log(`[HOOK] Generation Job state changed: ${record.id} -> ${record.status} (${record.progress}%)`);
  return record;
}
