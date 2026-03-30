import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskClients, helpdeskClientEmails } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clientList = await db
    .select()
    .from(helpdeskClients)
    .orderBy(helpdeskClients.clientName)

  return NextResponse.json({ clients: clientList })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { clientName, primaryEmail, phone, siteAddress, slaTier, emails } = body

  if (!clientName || !primaryEmail) {
    return NextResponse.json({ error: 'Client name and primary email required' }, { status: 400 })
  }

  const [client] = await db
    .insert(helpdeskClients)
    .values({
      clientName,
      primaryEmail: primaryEmail.toLowerCase().trim(),
      phone,
      siteAddress,
      slaTier: slaTier ?? 'standard',
    })
    .returning()

  // Register emails
  const emailList = emails ?? [primaryEmail]
  for (const email of emailList) {
    await db.insert(helpdeskClientEmails).values({
      clientId: client.id,
      email: email.toLowerCase().trim(),
      isPrimary: email.toLowerCase().trim() === primaryEmail.toLowerCase().trim(),
    })
  }

  return NextResponse.json({ client }, { status: 201 })
}
