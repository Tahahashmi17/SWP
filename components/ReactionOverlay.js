'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ReactionOverlay({ reactions = [], onReactionComplete }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{
              x: reaction.x,
              y: '100%',
              opacity: 0,
              scale: 0.5,
              rotate: -20
            }}
            animate={{
              y: '-20%',
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1, 0.8],
              rotate: [20, -10, 10, 0],
              x: reaction.x + (Math.random() - 0.5) * 100
            }}
            exit={{
              opacity: 0,
              scale: 0
            }}
            transition={{
              duration: 8,
              ease: 'easeOut'
            }}
            onAnimationComplete={() => onReactionComplete(reaction.id)}
            className="absolute text-8xl"
            style={{
              left: `${reaction.x}%`,
              bottom: 0,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}