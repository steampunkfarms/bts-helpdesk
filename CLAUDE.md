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

## QA Protocol

Inherits full CC Post-Execution QA Protocol from BTS family CLAUDE.md (Tier 2+).
