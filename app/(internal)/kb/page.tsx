'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  slug: string
  category: string | null
  isPublished: boolean
  viewCount: number
  helpfulCount: number
  createdAt: string
  updatedAt: string
}

export default function KbManagementPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  async function loadArticles() {
    const res = await fetch('/api/kb')
    setArticles(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadArticles() }, [])

  async function togglePublish(article: Article) {
    await fetch(`/api/kb/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !article.isPublished }),
    })
    await loadArticles()
  }

  async function deleteArticle(id: string) {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await fetch(`/api/kb/${id}`, { method: 'DELETE' })
    await loadArticles()
  }

  const published = articles.filter((a) => a.isPublished).length
  const drafts = articles.filter((a) => !a.isPublished).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Knowledge Base</h2>
          <p className="text-sm text-gray-400 mt-1">
            {published} published / {drafts} draft{drafts !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/kb/new"
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          + New Article
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading articles...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Views</th>
                <th className="text-left px-4 py-3 font-medium">Helpful</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No articles yet. Create one or generate from a resolved ticket.
                  </td>
                </tr>
              ) : (
                articles.map((a) => (
                  <tr key={a.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/kb/${a.id}`} className="text-orange-400 hover:text-orange-300">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{a.category ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                        a.isPublished
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {a.isPublished ? 'published' : 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{a.viewCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{a.helpfulCount}</td>
                    <td className="px-4 py-3 space-x-2">
                      <Link href={`/kb/${a.id}`} className="text-xs text-gray-400 hover:text-white">
                        Edit
                      </Link>
                      <button
                        onClick={() => togglePublish(a)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {a.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => deleteArticle(a.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
