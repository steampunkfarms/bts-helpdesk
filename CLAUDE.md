# CLAUDE.md — BTS Helpdesk (helpdesk.tronboll.us)

## Identity Guard

> **THIS IS THE BTS HELPDESK PROJECT PROTOCOL.**
> Scope: `/Users/ericktronboll/Projects/Backcountry Tech Solutions/bts-helpdesk/` only.
> Inherits from `Backcountry Tech Solutions/CLAUDE.md` (BTS family protocol).
> For global routing: `~/.claude/CLAUDE.md`.
> If this file conflicts with the BTS family CLAUDE.md, this file wins for bts-helpdesk work.

## Changelog

- 2026-03-30a: Initial scaffold. Sprint 1 — project setup, schema, auth, internal ticketing UI, email gateway, Twilio bridge, AI triage.

---

## Project Overview

| Field | Value |
|-------|-------|
| **Site** | BTS Helpdesk — ticketing system for the MSP practice |
| **Domain** | `helpdesk.tronboll.us` |
| **Hosting** | Vercel (`steampunk-studiolo` team) |
| **Database** | Neon Postgres (separate from bts-site) |
| **Purpose** | Support tickets, KB, client portal, AI triage |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router + Turbopack |
| Language | TypeScript 5.7+ strict |
| Styling | Tailwind CSS v4 |
| Database | Neon Postgres via Drizzle ORM |
| Auth | Credentials (tech/admin) + magic link (all roles) |
| Email | Resend (inbound webhook + outbound) |
| AI Primary | Anthropic Claude Sonnet 4.6 (triage, drafts) |
| AI Secondary | Anthropic Claude Haiku 4.5 (KB search) |
| Phone | Twilio (IVR stays in bts-site, bridge via API) |

---

## Architecture

### Three Auth Roles

| Role | Auth Method | Sees |
|------|------------|------|
| client | Magic link only | Own tickets, published KB |
| tech | Password + magic link | All client tickets + assigned internal, KB CRUD |
| admin | Password + magic link | Everything |

### Key Rules

- Client registration is manual (no self-registration)
- AI never sends anything to a client without human approval
- Internal tickets and internal notes are NEVER returned by portal API
- Email inbound rejects unregistered senders with polite bounce
- Always return 200 to Resend webhooks (domain suspension risk)

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `RESEND_API_KEY` | Resend transactional email |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret for inbound webhook |
| `HELPDESK_INTERNAL_SECRET` | Twilio bridge auth (bts-site → helpdesk) |
| `ANTHROPIC_API_KEY` | Claude Sonnet/Haiku (triage, KB search) |
| `ADMIN_PASSWORD` | Initial admin user password |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `SITE_URL` | `https://helpdesk.tronboll.us` |
| `INTERNAL_SECRET` | Orchestrator auth (future) |

---

## Handoff Sanity Check — MANDATORY

CChat (Strategist) designs from outside the codebase and does not follow execution
protocols. CC (Executor) sees production state and is the last line of defense
before changes hit live systems. **Every CChat handoff is a design, not a law.**

Before implementing any handoff, CC must run a Pre-Edit Sanity Pass:

1. **Data state check:** Query existing DB records, sent invoices, live assignments,
   and any state the handoff assumes or modifies. The handoff describes intent —
   the actual production data may have diverged.
2. **Conflict check:** Validate that the handoff does not contradict existing
   architecture, naming conventions, unique constraints, FK relationships, or
   live data (e.g., already-sent invoices tied to a record the handoff renames).
3. **Reversibility check:** Identify which steps affect already-sent, already-paid,
   or already-deployed records. Flag these for extra scrutiny.

- If clean: proceed with execution as mapped.
- If conflicts found: emit a **Sanity Delta** before proceeding:
  - What the handoff says vs. what production state shows
  - Minimal correction with file/anchor evidence
  - Risk if the handoff were followed as-written
  - Adjusted acceptance criteria (if needed)
  - Present the delta to the operator for approval before executing

### Bounded Deviation Rule

CC may deviate from handoff instructions only when ALL are true:

1. Evidence is file-anchored and reproducible
2. Deviation is minimal and risk-reducing
3. Scope does not expand materially

If scope expands, stop and request human confirmation.
All deviations must be logged as "Sanity Delta Applied" in the completion summary.

---

## QA Protocol

Inherits full CC Post-Execution QA Protocol from BTS family CLAUDE.md (Tier 2+).
