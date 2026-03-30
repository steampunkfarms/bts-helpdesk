import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })
  }
  return client
}

export interface TriageResult {
  category: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  summary: string
  draftResponse: string
  confidence: number
}

const SYSTEM_PROMPT = `You are the AI triage assistant for Backcountry Tech Solutions, an MSP serving remote California businesses. Analyze support requests and return a JSON object with:

1. "category" — one of: Internet / Network Down, Payment Processing Down, Well / Water System Down, Power / Generator Down, Access Gate / Door Failure, Endpoint Monitoring, Network Infrastructure, Proactive Maintenance, Third-Party Admin, Security, Documentation, Web Application, Hosting / DNS, Email / Communications, Internal Task, Site Audit, Maintenance Window
2. "priority" — one of: critical (client work stoppage), high (degraded but operational), normal (request or non-urgent), low (question, docs, nice-to-have)
3. "summary" — one-sentence summary of the issue
4. "draftResponse" — a professional but warm response draft for the tech to review before sending to the client. Address the client directly.
5. "confidence" — 0-100 how confident you are in the categorization

Return ONLY valid JSON, no markdown fences.`

export async function triageTicket(params: {
  subject: string
  body: string
  clientName?: string
  slaTier?: string
}): Promise<TriageResult> {
  const anthropic = getClient()

  const userPrompt = [
    `Subject: ${params.subject}`,
    `Body: ${params.body}`,
    params.clientName ? `Client: ${params.clientName}` : '',
    params.slaTier ? `SLA Tier: ${params.slaTier}` : '',
  ].filter(Boolean).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text) as TriageResult
  } catch {
    return {
      category: 'Internal Task',
      priority: 'normal',
      summary: params.subject,
      draftResponse: '',
      confidence: 0,
    }
  }
}
