import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { helpdeskUsers, helpdeskClients, helpdeskClientEmails } from '../lib/schema'
import bcrypt from 'bcryptjs'

async function seed() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle(sql)

  console.log('Seeding admin user...')
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'changeme', 12)

  await db.insert(helpdeskUsers).values({
    email: 'erick@tronboll.us',
    name: 'Erick Tronboll',
    role: 'admin',
    passwordHash,
  }).onConflictDoNothing()

  // Seed initial clients from the BTS IVR spec
  const clientSeeds = [
    { clientName: 'Coldwell Banker Borrego', primaryEmail: 'kathy@cbborrego.com', phone: '+17603101065', slaTier: 'priority' as const },
    { clientName: 'Clairemont Water Store', primaryEmail: 'cathy@clairemontwater.store', phone: null, slaTier: 'standard' as const },
    { clientName: 'Volcan Valley Apple Farm', primaryEmail: 'chris@volcanvalleyapple.farm', phone: null, slaTier: 'standard' as const },
    { clientName: 'Semper Vets', primaryEmail: 'starlene@sempervets.com', phone: null, slaTier: 'standard' as const },
  ]

  for (const c of clientSeeds) {
    console.log(`Seeding client: ${c.clientName}`)
    const [client] = await db.insert(helpdeskClients).values(c).onConflictDoNothing().returning()
    if (client) {
      await db.insert(helpdeskClientEmails).values({
        clientId: client.id,
        email: c.primaryEmail.toLowerCase(),
        isPrimary: true,
      }).onConflictDoNothing()
    }
  }

  console.log('Seed complete.')
}

seed().catch(console.error)
