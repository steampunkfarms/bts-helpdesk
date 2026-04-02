'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Article {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  category: string | null
  clientId: string | null
  isPublished: boolean
  tags: string[] | null
  sourceTicketId: string | null
}

const CATEGORIES = [
  'Getting Started', 'Troubleshooting', 'How-To', 'Security',
  'Network', 'Email', 'Printing', 'Software',
]

export default function KbArticleEditorPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: '',
    isPublished: false,
    tags: '',
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/kb/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data)
        setForm({
          title: data.title ?? '',
          slug: data.slug ?? '',
          content: data.content ?? '',
          excerpt: data.excerpt ?? '',
          category: data.category ?? '',
          isPublished: data.isPublished ?? false,
          tags: (data.tags ?? []).join(', '),
        })
        setLoading(false)
      })
  }, [params.id, isNew])

  function handleTitleChange(title: string) {
    setForm({
      ...form,
      title,
      slug: isNew
        ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : form.slug,
    })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      excerpt: form.excerpt || null,
      category: form.category || null,
      isPublished: form.isPublished,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }

    if (isNew) {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        router.push(`/kb/${created.id}`)
      }
    } else {
      await fetch(`/api/kb/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
  }

  if (loading) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/kb')} className="text-xs text-gray-400 hover:text-white mb-2 block">
            &larr; Back to Knowledge Base
          </button>
          <h2 className="text-xl font-bold">{isNew ? 'New Article' : 'Edit Article'}</h2>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-400 mr-4">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="rounded"
            />
            Published
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !form.title || !form.slug || !form.content}
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="Article title"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
              placeholder="url-friendly-slug"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">No category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="wifi, network, troubleshooting"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Excerpt (for search results)</label>
          <input
            type="text"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Brief 1-2 sentence summary"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Content (Markdown)</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={20}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
            placeholder="## Problem&#10;&#10;Describe the issue...&#10;&#10;## Solution&#10;&#10;1. First step&#10;2. Second step"
          />
        </div>

        {/* Preview */}
        {form.content && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Preview</label>
            <div className="bg-white text-gray-900 rounded-lg p-6 prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
