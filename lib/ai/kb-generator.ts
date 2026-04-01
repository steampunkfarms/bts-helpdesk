import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })
  }
  return client
}

export interface KbDraft {
  title: string
  slug: string
  content: string
  excerpt: string
  category: string
  tags: string[]
}

const SYSTEM_PROMPT = `You are a technical writer for Backcountry Tech Solutions, an MSP serving remote California businesses. Generate a knowledge base article from a resolved support ticket thread.

The article should help the client self-serve if they encounter the same issue again, or help other clients with similar problems.

Return a JSON object with:
1. "title" — Clear, searchable article title (not the ticket subject — rewrite for discoverability)
2. "slug" — URL-safe lowercase slug derived from the title (letters, numbers, hyphens only)
3. "content" — The article body in HTML. Structure with:
   - A brief description of the problem
   - Step-by-step solution (if applicable)
   - Any preventive measures or tips
   - Keep it non-technical — these are for business owners, not IT staff
4. "excerpt" — 1-2 sentence plain text summary for search results
5. "category" — One of: Getting Started, Troubleshooting, How-To, Security, Network, Email, Printing, Software
6. "tags" — Array of 2-4 relevant search tags

TONE: Helpful, clear, zero jargon. Write for someone who calls their computer "the machine."
Do NOT include internal ticket numbers, tech names, or confidential details.
Return ONLY valid JSON, no markdown fences.`

export async function generateKbArticle(params: {
  ticketSubject: string
  ticketCategory: string
  messages: { content: string; source: string; isInternal: boolean }[]
}): Promise<KbDraft> {
  const anthropic = getClient()

  // Filter out internal messages — only use client-facing thread
  const visibleMessages = params.messages
    .filter((m) => !m.isInternal)
    .map((m) => `[${m.source}]: ${m.content}`)
    .join('\n\n')

  const userPrompt = [
    `Ticket Subject: ${params.ticketSubject}`,
    `Category: ${params.ticketCategory}`,
    '',
    'Ticket Thread (client-facing messages only):',
    visibleMessages,
  ].join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text) as KbDraft
  } catch {
    return {
      title: `How to resolve: ${params.ticketSubject}`,
      slug: params.ticketSubject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      content: `<p>This article was auto-generated but could not be parsed. Please edit manually.</p>`,
      excerpt: params.ticketSubject,
      category: 'Troubleshooting',
      tags: ['auto-generated'],
    }
  }
}
