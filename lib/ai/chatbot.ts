import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { helpdeskKbArticles } from '@/lib/schema'
import { eq, and, or, isNull } from 'drizzle-orm'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })
  }
  return client
}

export interface ChatbotResponse {
  confident: boolean
  answer: string
  citedArticles: string[] // article slugs
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  kbArticleIds?: string[]
  feedback?: 'up' | 'down' | null
}

export async function loadKbContext(clientId: string): Promise<string> {
  const articles = await db
    .select({
      title: helpdeskKbArticles.title,
      slug: helpdeskKbArticles.slug,
      category: helpdeskKbArticles.category,
      content: helpdeskKbArticles.content,
    })
    .from(helpdeskKbArticles)
    .where(
      and(
        eq(helpdeskKbArticles.isPublished, true),
        or(
          isNull(helpdeskKbArticles.clientId),
          eq(helpdeskKbArticles.clientId, clientId),
        ),
      )
    )

  if (articles.length === 0) return ''

  return articles
    .map((a) => `---\nTitle: ${a.title}\nSlug: ${a.slug}\nCategory: ${a.category ?? 'General'}\nContent:\n${a.content}\n---`)
    .join('\n\n')
}

function buildSystemPrompt(clientName: string, kbContext: string): string {
  return `You are the BTS Help Center assistant for ${clientName}. You help staff with IT questions using the knowledge base articles below.

RULES:
- Only answer based on the KB articles provided. Do not guess or use general knowledge.
- If no KB article covers the question, set confident to false.
- When you answer, cite which article(s) you used by slug.
- Keep answers concise and non-technical — the audience is office staff, not IT professionals.
- Respond with JSON only: { "confident": true|false, "answer": "...", "citedArticles": ["slug-1"] }
- Do NOT wrap the JSON in markdown code fences.

KB ARTICLES:
${kbContext}`
}

export async function getChatbotResponse(params: {
  clientName: string
  clientId: string
  conversationHistory: ChatMessage[]
  userMessage: string
}): Promise<ChatbotResponse> {
  const anthropic = getClient()
  const kbContext = await loadKbContext(params.clientId)

  if (!kbContext) {
    return {
      confident: false,
      answer: "I don't have any help articles available right now. Would you like to submit a help ticket so Erick can look into this?",
      citedArticles: [],
    }
  }

  const systemPrompt = buildSystemPrompt(params.clientName, kbContext)

  // Build conversation messages — include history for multi-turn context
  const messages: { role: 'user' | 'assistant'; content: string }[] = []

  // Include recent history (last 10 turns to stay within context limits)
  const recentHistory = params.conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // Add current user message
  messages.push({ role: 'user', content: params.userMessage })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as ChatbotResponse
    return {
      confident: parsed.confident ?? false,
      answer: parsed.answer ?? '',
      citedArticles: parsed.citedArticles ?? [],
    }
  } catch {
    return {
      confident: false,
      answer: "I had trouble processing that. Would you like to submit a help ticket so Erick can help?",
      citedArticles: [],
    }
  }
}
