'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  kbArticleIds?: string[]
  feedback?: 'up' | 'down' | null
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [escalated, setEscalated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check for active session on mount
  useEffect(() => {
    fetch('/api/chatbot/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.active) {
          setSessionId(data.sessionId)
          setTicketNumber(data.ticketNumber)
          setMessages(data.messages ?? [])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return

    const userMessage = input.trim()
    setInput('')
    setSending(true)

    if (!sessionId) {
      // First message — create session
      const res = await fetch('/api/chatbot/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })
      if (res.ok) {
        const data = await res.json()
        setSessionId(data.sessionId)
        setTicketNumber(data.ticketNumber)
        setMessages(data.messages)

        // Now get the AI response
        const msgRes = await fetch('/api/chatbot/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: data.sessionId, message: userMessage }),
        })
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: msgData.answer,
              timestamp: new Date().toISOString(),
              kbArticleIds: msgData.citedArticles,
            },
          ])
        }
      }
    } else {
      // Subsequent message
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      ])

      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            timestamp: new Date().toISOString(),
            kbArticleIds: data.citedArticles,
          },
        ])
      }
    }
    setSending(false)
  }

  async function handleResolve() {
    if (!sessionId) return
    await fetch('/api/chatbot/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setResolved(true)
  }

  async function handleEscalate() {
    if (!sessionId) return
    await fetch('/api/chatbot/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setEscalated(true)
  }

  async function handleFeedback(index: number, feedback: 'up' | 'down') {
    if (!sessionId) return
    await fetch('/api/chatbot/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messageIndex: index, feedback }),
    })
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, feedback } : m))
    )
  }

  function startNewChat() {
    setSessionId(null)
    setTicketNumber(null)
    setMessages([])
    setResolved(false)
    setEscalated(false)
  }

  // Floating button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-700 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center z-50"
        aria-label="Open help chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col z-50 max-sm:inset-4 max-sm:w-auto max-sm:h-auto">
      {/* Header */}
      <div className="bg-orange-700 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">BTS Help Center</p>
          {ticketNumber && (
            <p className="text-xs opacity-80">Chat #{ticketNumber}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white"
          aria-label="Close chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !resolved && !escalated && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="mb-2">How can we help?</p>
            <p className="text-xs">Ask a question and we'll check our knowledge base.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-orange-700 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>

              {/* Feedback buttons for assistant messages */}
              {m.role === 'assistant' && !resolved && !escalated && (
                <div className="flex items-center gap-2 mt-2 pt-1 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleFeedback(i, 'up')}
                    className={`text-xs ${m.feedback === 'up' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                  >
                    {m.feedback === 'up' ? '(thumbs up)' : '(thumbs up)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(i, 'down')}
                    className={`text-xs ${m.feedback === 'down' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`}
                  >
                    {m.feedback === 'down' ? '(thumbs down)' : '(thumbs down)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}

        {resolved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm text-green-800 font-medium">Glad we could help!</p>
            <button type="button" onClick={startNewChat} className="text-xs text-green-700 underline mt-1">
              Ask another question
            </button>
          </div>
        )}

        {escalated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-800 font-medium">Ticket submitted to Erick</p>
            <p className="text-xs text-blue-600 mt-1">We'll get back to you as soon as possible.</p>
            <button type="button" onClick={startNewChat} className="text-xs text-blue-700 underline mt-2">
              Start a new chat
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action buttons (after first assistant response) */}
      {messages.some((m) => m.role === 'assistant') && !resolved && !escalated && (
        <div className="px-4 pb-2 flex gap-2">
          <button
            type="button"
            onClick={handleResolve}
            className="flex-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
          >
            This helped, thanks!
          </button>
          <button
            type="button"
            onClick={handleEscalate}
            className="flex-1 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100"
          >
            I need more help
          </button>
        </div>
      )}

      {/* Input */}
      {!resolved && !escalated && (
        <form onSubmit={handleSend} className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-3 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
