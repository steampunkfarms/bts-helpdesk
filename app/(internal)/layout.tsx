import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role === 'client') redirect('/login')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-orange-500">BTS Helpdesk</h1>
          <p className="text-xs text-gray-500 mt-1">{session.name}</p>
        </div>

        <div className="flex-1 p-3 space-y-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/tickets">Tickets</NavLink>
          <NavLink href="/tickets/new">New Ticket</NavLink>
          <NavLink href="/clients">Clients</NavLink>
          {session.role === 'admin' && <NavLink href="/users">Users</NavLink>}
        </div>

        <div className="p-3 border-t border-gray-800">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-300">
              Sign Out
            </button>
          </form>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md"
    >
      {children}
    </Link>
  )
}
