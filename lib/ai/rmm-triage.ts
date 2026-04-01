import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })
  }
  return client
}

export interface RmmTriageResult {
  actionable: boolean
  priority: 'critical' | 'high' | 'normal' | 'low'
  summary: string
  groupWithTicketId?: string
}

const SYSTEM_PROMPT = `You are an RMM alert triage agent for Backcountry Tech Solutions, an MSP serving remote California businesses. Analyze system alerts from Tactical RMM and determine:

1. "actionable" — Is this alert something that requires attention, or is it noise (routine info-level events, successful patch confirmations, normal metric fluctuations)?
2. "priority" — One of: critical (system down or data at risk), high (degraded performance or security concern), normal (needs attention but not urgent), low (informational, can batch)
3. "summary" — One-sentence plain-language summary suitable for a ticket subject line. No jargon.
4. "groupWithTicketId" — If there is an existing open ticket for the same machine with a related issue (provided in context), return that ticket ID. Otherwise omit this field.

Return ONLY valid JSON, no markdown fences.`

export async function triageRmmAlert(params: {
  alertType: string
  severity: string
  message: string
  hostname: string
  agentId: string
  openTickets: { id: string; subject: string; createdAt: string }[]
}): Promise<RmmTriageResult> {
  const anthropic = getClient()

  const userPrompt = [
    `Alert Type: ${params.alertType}`,
    `Severity: ${params.severity}`,
    `Message: ${params.message}`,
    `Hostname: ${params.hostname}`,
    `Agent ID: ${params.agentId}`,
    params.openTickets.length > 0
      ? `Open tickets for this machine:\n${params.openTickets.map((t) => `  - ${t.id}: "${t.subject}" (opened ${t.createdAt})`).join('\n')}`
      : 'No open tickets for this machine.',
  ].join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text) as RmmTriageResult
  } catch {
    return {
      actionable: true,
      priority: 'normal',
      summary: `RMM alert: ${params.alertType} on ${params.hostname}`,
    }
  }
}
