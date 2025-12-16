'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

export default function ChatPanel({ 
  messages = [], 
  onSendMessage, 
  currentUser,
  isOpen,
  onToggle 
}) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleSend = (e) => {
    e.preventDefault()
    if (inputMessage.trim()) {
      onSendMessage(inputMessage.trim())
      setInputMessage('')
    }
  }

  // Generate consistent color for each username
  const getUserColor = (username) => {
    const colors = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-yellow-500',
      'from-red-500 to-rose-500',
      'from-indigo-500 to-purple-500',
      'from-teal-500 to-green-500',
      'from-pink-500 to-rose-500'
    ]
    let hash = 0
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const formatTime = (date) => {
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  return (
    <>
      {/* Toggle button - always visible */}
      <button
        onClick={onToggle}
        className={`fixed ${isOpen ? 'right-[320px] sm:right-[400px]' : 'right-4'} bottom-4 z-50 bg-accent hover:bg-accent/90 p-4 rounded-full shadow-lg transition-all duration-300 group`}
        title={isOpen ? 'Close Chat' : 'Open Chat'}
      >
        {isOpen ? (
          <ChevronRightIcon className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
            {messages.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 sm:hidden"
            />

            {/* Chat container */}
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', bounce: 0.15 }}
              className="fixed right-0 top-0 bottom-0 w-[320px] sm:w-[400px] bg-secondary/95 backdrop-blur-lg border-l border-white/10 z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-white">Chat</h3>
                  <span className="text-xs text-gray-400">({messages.length})</span>
                </div>
                <button
                  onClick={onToggle}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <ChatBubbleLeftRightIcon className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {msg.type === 'system' ? (
                        // System message (user joined/left)
                        <div className="flex justify-center">
                          <div className="bg-white/5 px-3 py-1 rounded-full text-xs text-gray-400">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        // Regular message
                        <div className={`flex ${msg.username === currentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] ${msg.username === currentUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                            {msg.username !== currentUser && (
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getUserColor(msg.username)} flex items-center justify-center text-white text-xs font-medium`}>
                                  {msg.username[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-gray-300">
                                  {msg.username}
                                </span>
                              </div>
                            )}
                            <div className={`${
                              msg.username === currentUser 
                                ? 'bg-accent text-white' 
                                : 'bg-primary/50 text-gray-100'
                            } px-4 py-2 rounded-2xl break-words`}>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-gray-500 px-2">
                              {formatTime(msg.createdAt || new Date())}
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <form 
                onSubmit={handleSend}
                className="p-4 border-t border-white/10"
              >
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-primary/50 text-white placeholder-gray-400 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent border border-white/10"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="bg-accent hover:bg-accent/90 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-xl transition-colors"
                  >
                    <PaperAirplaneIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-right">
                  {inputMessage.length}/500
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}