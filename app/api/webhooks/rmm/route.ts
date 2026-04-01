import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { processRmmAlert, type RmmAlertPayload } from '@/lib/rmm/process-alert'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.RMM_WEBHOOK_SECRET?.trim()
  if (!secret) return false

  const provided = request.headers.get('x-rmm-secret') ?? ''
  if (provided.length !== secret.length) return false

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Tactical RMM webhook payload normalization
    const alert: RmmAlertPayload = {
      alert_id: body.alert_id ?? body.id ?? crypto.randomUUID(),
      agent_id: body.agent_id ?? body.agent?.id ?? '',
      hostname: body.hostname ?? body.agent?.hostname ?? 'unknown',
      alert_type: body.alert_type ?? body.type ?? 'custom',
      severity: body.severity ?? 'warning',
      message: body.message ?? body.alert_message ?? body.text ?? '',
      raw: body,
    }

    const result = await processRmmAlert(alert)

    await auditLog({
      entityType: 'rmm_webhook',
      entityId: alert.alert_id,
      action: 'rmm_alert_received',
      userId: 'system',
      afterData: result,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[rmm-webhook] Error:', e)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
