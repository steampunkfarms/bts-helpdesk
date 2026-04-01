import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'client' || !session.clientId) {
    redirect('/portal/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="text-lg font-bold text-orange-700">
              BTS Support
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/portal/tickets" className="text-gray-600 hover:text-gray-900">
                My Tickets
              </Link>
              <Link href="/portal/reports" className="text-gray-600 hover:text-gray-900">
                Reports
              </Link>
              <Link href="/portal/kb" className="text-gray-600 hover:text-gray-900">
                Help Center
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.name}</span>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-sm text-gray-400">
        <p>Backcountry Tech Solutions / helpdesk@tronboll.us / (760) 782-8476</p>
      </footer>
    </div>
  )
}
