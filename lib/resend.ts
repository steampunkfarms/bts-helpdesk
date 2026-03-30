import { Resend } from 'resend'

let client: Resend | null = null

export function getResendClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY?.trim()
    if (!key) throw new Error('RESEND_API_KEY not set')
    client = new Resend(key)
  }
  return client
}

export const FROM_ADDRESS = 'BTS Helpdesk <noreply@tronboll.us>'
