'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  category: string | null
  tags: string[] | null
  viewCount: number
  helpfulCount: number
  createdAt: string
  updatedAt: string
}

export default function PortalKbArticlePage() {
  const params = useParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackGiven, setFeedbackGiven] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/kb/${params.slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setArticle(data); setLoading(false) })
  }, [params.slug])

  async function handleFeedback(helpful: boolean) {
    if (!article || feedbackGiven) return
    setFeedbackGiven(true)
    await fetch(`/api/portal/kb/${article.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful }),
    })
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>
  if (!article) return <p className="text-gray-400 text-sm">Article not found.</p>

  return (
    <div className="max-w-3xl">
      <Link href="/portal/kb" className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">
        &larr; Back to Help Center
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{article.title}</h1>

      <div className="flex gap-2 mb-6">
        {article.category && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {article.category}
          </span>
        )}
        <span className="text-xs text-gray-400">
          Updated {new Date(article.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 prose prose-sm max-w-none text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: article.content }} />
      </div>

      {/* Feedback */}
      <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center">
        {feedbackGiven ? (
          <p className="text-sm text-gray-500">Thanks for your feedback!</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">Was this article helpful?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleFeedback(true)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-green-400 hover:text-green-700"
              >
                Yes, helpful
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400"
              >
                Not really
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
