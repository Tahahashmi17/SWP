'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaceSmileIcon } from '@heroicons/react/24/outline'

const EMOJIS = [
  { emoji: '😂', label: 'Laughing' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clapping' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '😍', label: 'Heart eyes' },
  { emoji: '💯', label: '100' },
  { emoji: '🤣', label: 'ROFL' },
  { emoji: '😭', label: 'Crying' },
  { emoji: '🙌', label: 'Hands up' }
]

export default function EmojiPicker({ onSelectEmoji, position = 'bottom' }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleEmojiClick = (emoji) => {
    onSelectEmoji(emoji)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* Emoji button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 hover:bg-white/20 rounded-lg transition-colors ${isOpen ? 'bg-white/20' : ''}`}
        title="Send Reaction"
      >
        <FaceSmileIcon className="w-5 h-5 text-white" />
      </button>

      {/* Emoji picker popup */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Emoji grid */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: position === 'bottom' ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.40 }}
              className={`absolute ${
                position === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'
              } left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-lg rounded-2xl p-3 shadow-2xl border border-white/10 z-50`}
            >
              <div className="grid grid-cols-4 gap-2">
                {EMOJIS.map(({ emoji, label }) => (
                  <motion.button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-3xl p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={label}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* Arrow pointer */}
              <div
                className={`absolute left-1/2 transform -translate-x-1/2 ${
                  position === 'bottom' ? '-bottom-2' : '-top-2'
                } w-4 h-4 bg-black/90 rotate-45 border ${
                  position === 'bottom'
                    ? 'border-t-0 border-l-0 border-white/10'
                    : 'border-b-0 border-r-0 border-white/10'
                }`}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}