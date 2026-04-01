'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  tags: string[] | null
}

export default function PortalKbPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function loadArticles(q?: string) {
    setLoading(true)
    const url = q ? `/api/portal/kb?q=${encodeURIComponent(q)}` : '/api/portal/kb'
    const res = await fetch(url)
    setArticles(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadArticles() }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadArticles(search)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Help Center</h1>
      <p className="text-sm text-gray-500 mb-6">
        Guides and answers to common questions.
      </p>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Search articles..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium rounded-lg"
          >
            Search
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : articles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          {search ? 'No articles match your search.' : 'No articles available yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/portal/kb/${a.slug}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-colors"
            >
              <p className="font-medium text-gray-900">{a.title}</p>
              {a.excerpt && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.excerpt}</p>
              )}
              <div className="flex gap-2 mt-2">
                {a.category && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {a.category}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
