import Anthropic from '@anthropic-ai/sdk'
import type { ReportData } from '@/lib/reports/data'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })
  }
  return client
}

type ReportType = 'monthly_summary' | 'quarterly_priority' | 'semi_annual_savings' | 'annual_review'

const PROMPTS: Record<ReportType, (data: ReportData) => string> = {
  monthly_summary: (data) => `You are writing a monthly IT management report for ${data.client.name}, a non-technical business owner. This report covers ${data.period.label}.

DATA:
${JSON.stringify(data, null, 2)}

Write a professional but warm one-page summary that demonstrates the value of proactive IT management. Structure as:

1. HEADLINE — One sentence capturing the month. Example: "A clean month with zero downtime and 23 maintenance tasks handled before you noticed them."

2. BY THE NUMBERS — 3-4 key stats in plain language. Not a data dump. Example: "We resolved 7 support requests, ran 23 automated maintenance tasks, and kept all 8 machines patched and monitored."

3. WHAT WE PREVENTED — Any proactive catches (disk warnings, patch failures, security events). Frame as problems avoided, not technical jargon. "We caught a failing disk on Robin's workstation before it caused data loss."

4. WHAT WE RESOLVED — Notable client-initiated tickets, briefly. "Kerry reported a printer issue Tuesday morning; it was fixed by lunch."

5. YOUR SLA PERFORMANCE — Response and resolution stats. Keep it simple: "Every request was acknowledged within 2 hours and resolved within our committed timeframe."

6. LOOKING AHEAD — Anything upcoming (patches, recommendations).

TONE: Professional, warm, zero jargon. The reader should finish thinking "I'm glad someone is handling this so I don't have to."

Do NOT fabricate events. Only reference tickets in the data.
Return plain text formatted with clear section headers.`,

  quarterly_priority: (data) => `You are writing a quarterly IT service report for ${data.client.name}. Period: ${data.period.label}.

DATA:
${JSON.stringify(data, null, 2)}

Create a brief 1-2 page report listing services rendered by Priority:

P1 (Critical): [count] incidents — [brief description of each, or "0 incidents — this is what proactive management looks like"]

P2 (High): [count] — [brief descriptions]

P3 (Medium): [count] — [brief descriptions]

P4 (Low): [count] — [brief descriptions]

Proactive (System-Initiated): [count] automated maintenance events

End with a one-paragraph summary. Clean, scannable, professional.

Do NOT fabricate events. Only reference tickets in the data.
Return plain text formatted with clear section headers.`,

  semi_annual_savings: (data) => `You are writing a semi-annual cost analysis for ${data.client.name}. Period: ${data.period.label}.

DATA:
${JSON.stringify(data, null, 2)}

Calculate and present what the IT services rendered during this period would have cost under a break-fix model (ad-hoc billing at $95/hr standard rate with $250 emergency arrival fee) versus what the client actually paid under the MSP agreement.

For each notable service event, estimate the break-fix cost:
- Proactive maintenance tasks: "Would have been discovered as a failure, requiring emergency response: 2hr on-site x $95 = $190 + $250 arrival = $440"
- Remote support: "At standard rate: X hours x $95 = $Y"
- P1 incidents: "Emergency response: $250 arrival + X hours x $125 = $Y"

Present a clear comparison table:
- Total services rendered under MSP
- Equivalent break-fix cost
- MSP cost for the period
- Client savings

TONE: Factual, not salesy. Let the numbers speak. Do NOT inflate estimates — conservative is more credible. Round to nearest $25.

Do NOT fabricate events. Only reference tickets in the data.
Return plain text formatted with clear section headers.`,

  annual_review: (data) => `You are writing an annual IT management review for ${data.client.name}. Period: ${data.period.label}.

DATA:
${JSON.stringify(data, null, 2)}

Create a comprehensive yet readable annual summary covering:

1. YEAR IN REVIEW — High-level narrative of what was accomplished
2. SERVICE SUMMARY — Total tickets, breakdown by type and priority
3. PROACTIVE VALUE — Total proactive interventions and what they prevented
4. SLA PERFORMANCE — Annual response and resolution metrics
5. COST ANALYSIS — Annual MSP cost vs estimated break-fix equivalent
6. RECOMMENDATIONS — Suggestions for the coming year

TONE: Professional, warm, zero jargon. This is the "state of your IT" report.

Do NOT fabricate events. Only reference tickets in the data.
Return plain text formatted with clear section headers.`,
}

export async function generateReportNarrative(
  reportType: ReportType,
  data: ReportData,
): Promise<string> {
  const anthropic = getClient()
  const prompt = PROMPTS[reportType](data)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
