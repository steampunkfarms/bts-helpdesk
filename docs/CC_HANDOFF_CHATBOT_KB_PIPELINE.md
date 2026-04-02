# CC Handoff: Chatbot → Ticket → Report Pipeline

**Date:** 2026-04-01
**Author:** CChat (Strategist)
**Status:** Ready for CC execution
**Depends on:** KB articles already seeded (7 articles, HTML format)

---

## Overview

Build a portal chatbot that uses KB articles (converted to markdown) to
answer client questions, creates a helpdesk ticket for every conversation,
and feeds resolution metrics into client reports and internal dashboards.

Two flows:
- **Flow A (Resolved):** Client asks → chatbot answers from KB → ticket auto-resolves
- **Flow B (Escalated):** Chatbot can't help → client clicks "Submit Ticket" → human workflow

---

## Build Order

1. Convert KB storage from HTML to markdown
2. Schema changes (new fields + new table)
3. Build chatbot widget on portal
4. Chatbot → ticket creation pipeline
5. Transcript storage and access
6. Auto-close logic with safety net
7. Chatbot metrics in report data builder
8. Chatbot section on internal dashboard

---

## Step 1: Convert KB to Markdown

**What:** The `helpdeskKbArticles.content` column currently stores HTML.
Switch to markdown storage. No schema migration needed — same `text` column.

**Changes:**

1. Convert all 7 seeded articles from HTML → markdown. Write a one-time
   script in `scripts/convert-kb-to-markdown.ts` that pulls each article,
   converts HTML to markdown (use `turndown` or similar), and updates the row.
2. In the portal article view (wherever `dangerouslySetInnerHTML` is used),
   replace with `react-markdown`. Install `react-markdown` + `remark-gfm`.
3. In the admin KB editor, update the textarea placeholder/label from
   "HTML Content" to "Markdown Content". The editor textarea itself doesn't
   change — markdown is just text.
4. Keep the `content` column as `text` — no schema change needed.

**Verify:** After conversion, load the portal KB and confirm all 7 articles
render correctly with headings, lists, bold, etc.

---

## Step 2: Schema Changes

### 2a. New fields on `helpdeskTickets`

Add to `lib/schema.ts` in the `helpdeskTickets` table:

```
resolvedBy: text('resolved_by'),  // 'chatbot' | 'tech' | 'client' | null
chatbotSessionId: text('chatbot_session_id'),  // links to chatbot_sessions.id
```

### 2b. New `source` value

The existing `source` field on `helpdeskTickets` accepts text. Add `'chatbot'`
as a valid value. No enum migration needed — it's already a text column.
Update any validation/UI that lists source options to include `'chatbot'`.

### 2c. New table: `helpdeskChatbotSessions`

```ts
export const helpdeskChatbotSessions = pgTable('helpdesk_chatbot_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => helpdeskTickets.id),
  userId: uuid('user_id').notNull().references(() => helpdeskUsers.id),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  messages: jsonb('messages').notNull().default('[]'),
  // messages format: [{ role: 'user'|'assistant', content: string, timestamp: ISO, kbArticleIds?: string[] }]
  kbArticlesCited: text('kb_articles_cited').array().default([]),  // article IDs referenced
  wasEscalated: boolean('was_escalated').notNull().default(false),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  feedbackRating: integer('feedback_rating'),  // 1 = thumbs down, 5 = thumbs up (per-session)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

**Why a separate table instead of JSONB on the ticket:** The chatbot session
has its own lifecycle (messages appended in real-time, feedback collected,
escalation tracked). Keeping it separate means the ticket table stays clean
and the transcript is always queryable for metrics.

### 2d. New field on `helpdeskKbArticles`

```
embedding: text('embedding'),  // nullable, for future pgvector migration
```

Also: enable the `pgvector` extension on the Neon database now:
`CREATE EXTENSION IF NOT EXISTS vector;`
Don't use the embedding column yet — this is prep for when KB grows past ~50 articles.

---

## Step 3: Chatbot Widget on Portal

**Location:** Floating widget on all portal pages (authenticated clients only).
Suggested: `app/(portal)/components/chatbot-widget.tsx`

**UI:**
- Floating button (bottom-right corner) with a chat icon
- Opens a panel/drawer with message history
- Input field at the bottom
- Each assistant message has thumbs-up / thumbs-down buttons
- "This helped, thanks!" button appears after each assistant response
- "I need more help — submit a ticket" button appears after each response
- Shows the ticket number at the top of the chat (e.g., "Chat #BTS-20260401-012")

**Auth:** Widget only renders for authenticated users with role='client'.
Pull `userId` and `clientId` from the session.

---

## Step 4: Chatbot → Ticket Creation Pipeline

### On first message:

1. Client types a question and hits send
2. **Immediately** create a ticket:
   - `source: 'chatbot'`
   - `status: 'in_progress'`
   - `subject:` first 80 chars of the client's question
   - `category: 'chatbot'`
   - `priority: 'normal'`
   - `clientId, createdByUserId` from session
3. Create a `helpdeskChatbotSessions` row linked to the ticket
4. Return the ticket number to the widget UI

### On each message exchange:

1. Fetch ALL published KB articles for this client (global + client-specific)
   as markdown. For ≤50 articles, dump all into the system prompt.
2. Call Haiku 4.5 with this system prompt structure:

```
System prompt:
You are the BTS Help Center assistant for [clientName]. You help staff
with IT questions using the knowledge base articles below.

RULES:
- Only answer based on the KB articles provided. Do not guess.
- If no KB article covers the question, say: "I'm not sure about that one.
  You can submit this as a help ticket and Erick will look into it."
- When you answer, cite which article you used by title.
- Keep answers concise and non-technical — the audience is office staff.
- Respond with JSON: { "confident": true|false, "answer": "...", "citedArticles": ["article-slug-1"] }

KB ARTICLES:
---
Title: [title]
Slug: [slug]
Category: [category]
Content:
[markdown content]
---
(repeat for each article)
```

3. Parse the JSON response. If `confident: false`, append the escalation
   prompt: "I'm not sure about that one — would you like to submit this
   as a help ticket so Erick can take a look?"
4. If `confident: true`, show the answer + cite the article:
   "Here's what to do: [answer]. Full guide: **[Article Title]**" (link to KB article)
5. Append both the user message and assistant response to the
   `helpdeskChatbotSessions.messages` JSONB array
6. Update `kbArticlesCited` array with any new article IDs referenced

### Confidence gating — why this matters:

A bad answer that auto-resolves is worse than an escalation. If Haiku
can't map the question to a specific KB article, it MUST say so. The
`confident` flag in the structured response enforces this. Do not fall
back to Haiku's general knowledge — KB-only answers.

---

## Step 5: Transcript Storage and Access

**This is a hard requirement.** Every chatbot ticket must have the full
conversation transcript accessible in two ways:

### 5a. Transcript IN the ticket (on escalation)

When a client clicks "I need more help — submit a ticket":
1. Set `helpdeskChatbotSessions.wasEscalated = true`, `escalatedAt = now()`
2. Change ticket `status` from `'in_progress'` to `'open'`
3. **Create a `helpdeskMessages` row** on the ticket with:
   - `source: 'system'`
   - `content:` formatted markdown transcript of the entire conversation:
     ```
     **Chatbot Transcript**
     ---
     **Client:** [first message]
     **Help Center:** [first response]
     **Client:** [second message]
     ...
     ---
     *Escalated to human support at [timestamp]*
     ```
   - `isInternal: false` (Erick needs to see this on the ticket)
4. SLA clock starts NOW (at escalation), not at original ticket creation.
   Set `slaResponseDue` based on the client's SLA tier, calculated from
   the escalation timestamp.

### 5b. Transcript linked FROM the ticket (always)

For ALL chatbot tickets (resolved or escalated), the ticket detail view
in the admin panel should show a "View Chatbot Transcript" link/section
that pulls from `helpdeskChatbotSessions.messages` where
`chatbotSessionId` matches.

This means:
- Resolved chatbot tickets: admin can review what the chatbot said
- Escalated tickets: transcript is both pasted as a message AND
  viewable in the session detail

---

## Step 6: Auto-Close Logic

Two resolution paths:

### 6a. Explicit resolution
Client clicks "This helped, thanks!" → immediately:
- Set ticket `status: 'resolved'`, `resolvedAt: now()`
- Set `resolvedBy: 'chatbot'`
- Record in audit log

### 6b. Inactivity auto-close
If no new messages for 30 minutes AND the ticket was not escalated:
- Set ticket `status: 'resolved'`, `resolvedAt: now()`
- Set `resolvedBy: 'chatbot'`
- Implementation: cron job (e.g., `/api/cron/chatbot-autoclose`) that
  runs every 15 minutes, finds chatbot tickets in `'in_progress'` status
  where `updatedAt` is >30 min ago and `wasEscalated = false`
- Use `verifyCronAuth()` per project convention

### 6c. Safety net — "Was this resolved?" toast
On the client's NEXT portal login after an auto-closed chatbot ticket:
- Show a toast/banner: "Last time you asked about '[subject]' — was that resolved?"
- Two buttons: "Yes, all good" / "No, I still need help"
- "Yes" → no action (ticket stays resolved)
- "No" → reopen ticket, set `status: 'open'`, `resolvedBy: null`,
  create a system message "Client reported issue unresolved — reopened"
- Query: find tickets where `source='chatbot'` AND `resolvedBy='chatbot'`
  AND `resolvedAt` is after the user's `lastLoginAt` (previous login)

---

## Step 7: Chatbot Feedback on Responses

Each chatbot assistant message in the widget should have thumbs-up /
thumbs-down buttons. Store per-message feedback in the JSONB messages
array:

```
{ role: 'assistant', content: '...', timestamp: '...', feedback: 'up'|'down'|null }
```

Also store an overall session rating in `helpdeskChatbotSessions.feedbackRating`.

---

## Step 8: Chatbot Metrics in Report Data Builder

**File:** `lib/reports/data.ts`

Add a new section to the report data object for chatbot metrics:

```ts
chatbot: {
  totalSessions: number,           // tickets where source='chatbot'
  resolvedByChatbot: number,       // resolvedBy='chatbot'
  escalatedToHuman: number,        // source='chatbot' AND wasEscalated=true
  resolutionRate: number,          // resolved / total (percentage)
  avgMessagesPerSession: number,   // from chatbot_sessions.messages array length
  topCitedArticles: { title: string, slug: string, count: number }[],
  gapTopics: string[],             // escalated tickets where kbArticlesCited is empty
  feedbackPositive: number,        // thumbs up count
  feedbackNegative: number,        // thumbs down count
}
```

### Client-facing report line (in `lib/reports/pdf.ts`):

If `resolvedByChatbot > 0`, include a paragraph like:
"This month, [X] of [Y] support questions were answered instantly by
your automated Help Center — no wait time, no appointment needed.
[Z] questions required hands-on attention from your IT team."

### Internal dashboard metrics:

| Metric | Query |
|--------|-------|
| Chatbot sessions this month | `source='chatbot'` tickets in period |
| Resolved by chatbot | `resolvedBy='chatbot'` |
| Escalated to human | `source='chatbot'` AND session `wasEscalated=true` |
| Resolution rate | resolved / total |
| Most-used KB articles | aggregate `kbArticlesCited` across sessions |
| Gap topics (no KB match) | escalations where `kbArticlesCited` is empty |
| Thumbs up rate | positive feedback / total feedback |

---

## Suggested API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chatbot/session` | POST | Create new session + ticket on first message |
| `/api/chatbot/message` | POST | Send message, get Haiku response, append to session |
| `/api/chatbot/resolve` | POST | Client clicked "This helped" — resolve ticket |
| `/api/chatbot/escalate` | POST | Client clicked "Submit Ticket" — escalate |
| `/api/chatbot/feedback` | POST | Thumbs up/down on a specific message |
| `/api/cron/chatbot-autoclose` | GET | Cron: auto-close stale chatbot sessions |

All routes except cron require authenticated client session.
Cron route uses `verifyCronAuth()`.

---

## File Paths Summary

| File | Action |
|------|--------|
| `lib/schema.ts` | Add `resolvedBy`, `chatbotSessionId` to tickets; add `helpdeskChatbotSessions` table; add `embedding` to KB articles |
| `lib/ai/chatbot.ts` | NEW — Haiku prompt builder, KB context loader, response parser |
| `app/(portal)/components/chatbot-widget.tsx` | NEW — floating chat widget |
| `app/api/chatbot/session/route.ts` | NEW |
| `app/api/chatbot/message/route.ts` | NEW |
| `app/api/chatbot/resolve/route.ts` | NEW |
| `app/api/chatbot/escalate/route.ts` | NEW |
| `app/api/chatbot/feedback/route.ts` | NEW |
| `app/api/cron/chatbot-autoclose/route.ts` | NEW |
| `scripts/convert-kb-to-markdown.ts` | NEW — one-time migration script |
| Portal KB article view | EDIT — swap `dangerouslySetInnerHTML` for `react-markdown` |
| Admin KB editor | EDIT — update label/placeholder text |
| `lib/reports/data.ts` | EDIT — add chatbot metrics section |
| `lib/reports/pdf.ts` | EDIT — add chatbot paragraph to client reports |
| Admin ticket detail view | EDIT — add "View Chatbot Transcript" link |

---

## Acceptance Criteria

### Must-have (block deployment without these)

- [ ] All 7 KB articles render correctly as markdown on the portal
- [ ] Admin KB editor saves and previews markdown (not HTML)
- [ ] Chatbot widget appears for authenticated client users only
- [ ] First message creates a ticket with `source='chatbot'` and returns ticket number
- [ ] Haiku responses are KB-only (no general knowledge leakage)
- [ ] `confident: false` responses show escalation prompt, never a guess
- [ ] Chatbot answers cite the KB article title with a link to the article
- [ ] "This helped, thanks!" resolves the ticket with `resolvedBy='chatbot'`
- [ ] "I need more help" escalates: pastes transcript into ticket as a
      `helpdeskMessages` row, changes status to `'open'`, starts SLA clock
- [ ] Escalated ticket shows full chatbot transcript in the message thread
- [ ] ALL chatbot tickets (resolved or escalated) have transcript accessible
      from the admin ticket detail view via "View Chatbot Transcript"
- [ ] Auto-close cron resolves stale chatbot sessions after 30 min inactivity
- [ ] Auto-close cron uses `verifyCronAuth()`
- [ ] "Was this resolved?" toast on next client login after auto-close
- [ ] Chatbot metrics appear in `lib/reports/data.ts` output
- [ ] Client report PDF includes chatbot resolution paragraph when applicable

### Nice-to-have (can ship without, add in follow-up)

- [ ] Thumbs up/down on individual chatbot messages
- [ ] Overall session feedback rating
- [ ] Gap topics surfaced on internal dashboard
- [ ] `pgvector` extension enabled (zero-cost prep)

---

## Edge Cases CC Must Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| Client refreshes browser mid-chat | Session persists — reload widget, fetch `helpdeskChatbotSessions.messages` by active session for this user, restore chat history |
| Client opens chatbot, types nothing, closes | No ticket created (ticket only on first message send) |
| Client has two browser tabs open | One active session per user. Second tab loads the same session. |
| Haiku returns malformed JSON | Catch parse error, show "Something went wrong — would you like to submit a help ticket?" with escalation button |
| Haiku times out | Same as malformed JSON — graceful fallback to escalation |
| Client sends 20 messages in one session | No hard limit, but Haiku context includes full conversation. If messages JSONB exceeds ~30 turns, truncate oldest messages in the prompt (keep first message + last 10) |
| KB has zero published articles for this client | Chatbot should not appear. Hide widget if no published articles exist. |
| Client is on mobile | Widget must be responsive. Full-screen drawer on mobile, side panel on desktop |
| Auto-close fires on a session where client is actively typing | The 30-min window is based on last message timestamp. If client sends a message, `updatedAt` resets. Cron won't touch active sessions. |

---

## Design Decisions Log (for CC reference)

1. **Separate `helpdeskChatbotSessions` table** rather than JSONB on ticket —
   keeps ticket table clean, transcript is independently queryable for metrics.

2. **Transcript pasted INTO ticket on escalation** (not just linked) — because
   Erick needs full context in the ticket thread without clicking elsewhere.
   The link to the session detail is a bonus for admin, not the primary access path.

3. **SLA starts at escalation, not ticket creation** — the client chose
   self-service first. Frederick's response obligation begins when the
   client explicitly asks for a human.

4. **Confidence gating via structured JSON response** — Haiku must return
   `{ confident, answer, citedArticles }`. If confident is false, the
   widget shows the escalation prompt. This prevents the chatbot from
   guessing based on general knowledge and giving bad advice.

5. **Markdown storage for KB** — drops cleanly into Haiku prompts with zero
   noise. HTML wastes tokens on tags. Also makes the admin editor simpler.

6. **pgvector prep now** — enable the extension and add a nullable column.
   Zero cost, avoids a migration later when KB grows past prompt-stuffing limits.

7. **Auto-close safety net (toast on next login)** — prevents inflated
   resolution metrics. A silently confused client who gave up is not a
   resolved ticket.

8. **No self-registration for chatbot** — chatbot is portal-only, portal
   requires manual client registration. This is intentional and should not change.

---

## Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| `react-markdown` | Render KB markdown on portal | `npm install react-markdown` |
| `remark-gfm` | GitHub-flavored markdown (tables, strikethrough) | `npm install remark-gfm` |
| `turndown` | One-time HTML → markdown conversion script | `npm install -D turndown` |

No new API keys needed. Haiku uses the existing `ANTHROPIC_API_KEY`.

---

*End of handoff. CC: run Sanity Pass per CLAUDE.md before executing.*
