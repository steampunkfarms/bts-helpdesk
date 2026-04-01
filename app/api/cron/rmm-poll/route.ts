import { NextRequest } from 'next/server'
import { verifyCronAuth, cronResponse } from '@/lib/cron-auth'
import { processRmmAlert, type RmmAlertPayload } from '@/lib/rmm/process-alert'

export const dynamic = 'force-dynamic'

interface TacticalRmmAlert {
  id: number
  agent_id: string
  hostname?: string
  alert_type: string
  severity: string
  message: string
  [key: string]: unknown
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return cronResponse({ error: 'Unauthorized' }, 401)
  }

  const rmmUrl = process.env.TACTICAL_RMM_URL?.trim()
  const rmmApiKey = process.env.TACTICAL_RMM_API_KEY?.trim()

  if (!rmmUrl || !rmmApiKey) {
    return cronResponse({ error: 'TACTICAL_RMM_URL or TACTICAL_RMM_API_KEY not configured' }, 500)
  }

  try {
    const response = await fetch(`${rmmUrl}/alerts/?pending=true`, {
      headers: {
        'X-API-KEY': rmmApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return cronResponse({
        error: `RMM API returned ${response.status}`,
        checked: 0, created: 0, dismissed: 0, grouped: 0, duplicates: 0,
      }, 502)
    }

    const alerts: TacticalRmmAlert[] = await response.json()

    let created = 0
    let dismissed = 0
    let grouped = 0
    let duplicates = 0

    for (const rmmAlert of alerts) {
      const payload: RmmAlertPayload = {
        alert_id: String(rmmAlert.id),
        agent_id: rmmAlert.agent_id ?? '',
        hostname: rmmAlert.hostname ?? 'unknown',
        alert_type: rmmAlert.alert_type ?? 'custom',
        severity: rmmAlert.severity ?? 'warning',
        message: rmmAlert.message ?? '',
        raw: rmmAlert,
      }

      const result = await processRmmAlert(payload)

      switch (result.action) {
        case 'created': created++; break
        case 'dismissed': dismissed++; break
        case 'grouped': grouped++; break
        case 'duplicate': duplicates++; break
      }
    }

    return cronResponse({
      checked: alerts.length,
      created,
      dismissed,
      grouped,
      duplicates,
    })
  } catch (e) {
    console.error('[rmm-poll] Error:', e)
    return cronResponse({ error: 'RMM poll failed', message: String(e) }, 500)
  }
}
