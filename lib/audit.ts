import { db } from './db'
import { helpdeskAuditLog } from './schema'

export async function auditLog(params: {
  entityType: string
  entityId: string
  action: string
  userId?: string
  beforeData?: unknown
  afterData?: unknown
}): Promise<void> {
  try {
    await db.insert(helpdeskAuditLog).values({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId ?? 'system',
      beforeData: params.beforeData ?? null,
      afterData: params.afterData ?? null,
    })
  } catch (e) {
    console.error('[audit] Failed to write audit log:', e)
  }
}
