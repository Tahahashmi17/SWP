'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon
} from '@heroicons/react/24/solid'
import { UserCircleIcon } from '@heroicons/react/24/outline'

function VideoTile({ stream, username, isMuted, isLocal, isSpeaking }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Get initials for avatar
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  // Generate color based on username
  const getUserColor = (name) => {
    const colors = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-yellow-500',
      'from-red-500 to-rose-500',
      'from-indigo-500 to-purple-500',
    ]
    let hash = 0
    for (let i = 0; i < (name?.length || 0); i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        boxShadow: isSpeaking ? '0 0 0 3px rgb(59, 130, 246)' : '0 0 0 0px transparent'
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative bg-gray-900 rounded-xl overflow-hidden ${
        isSpeaking ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} // Mute own camera to prevent feedback
            className="w-full h-full object-cover"
          />
          
          {/* Video overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </>
      ) : (
        // No video - show avatar
        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getUserColor(username)}`}>
          <div className="text-6xl font-bold text-white">
            {getInitials(username)}
          </div>
        </div>
      )}

      {/* Username label */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg">
          <span className="text-white text-sm font-medium truncate">
            {username} {isLocal && '(You)'}
          </span>
        </div>

        {/* Mute indicator */}
        <div className="flex items-center gap-1">
          {!stream && (
            <div className="bg-red-500/90 backdrop-blur-sm p-1.5 rounded-lg">
              <VideoCameraSlashIcon className="w-4 h-4 text-white" />
            </div>
          )}
          {isMuted && (
            <div className="bg-red-500/90 backdrop-blur-sm p-1.5 rounded-lg">
              <MicrophoneIcon className="w-4 h-4 text-white line-through" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function VideoGallery({ participants = [], currentUsername, sidebarMode = false }) {
  // Calculate grid layout based on participant count
  const getGridClass = (count) => {
    if (sidebarMode) {
      // Sidebar mode: always 1 column
      return 'grid-cols-1'
    }
    // Full screen mode
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count <= 4) return 'grid-cols-2 md:grid-cols-2'
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3'
    if (count <= 9) return 'grid-cols-3 md:grid-cols-3'
    return 'grid-cols-3 md:grid-cols-4'
  }

  // Calculate aspect ratio based on count
  const getAspectRatio = (count) => {
    if (sidebarMode) {
      return 'aspect-video' // 16:9 for sidebar tiles
    }
    if (count === 1) return 'aspect-video'
    if (count === 2) return 'aspect-video'
    return 'aspect-square'
  }

  if (participants.length === 0) {
    return null // Don't show anything if no cameras
  }

  if (sidebarMode) {
    // Floating sidebar mode
    return (
      <div className="fixed right-4 top-4 z-40 w-64 max-h-[calc(100vh-8rem)] overflow-y-auto bg-gray-900/95 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl">
        <div className="p-3 border-b border-white/10">
          <h3 className="text-white text-sm font-medium">Participants ({participants.length})</h3>
        </div>
        <div className="p-3 space-y-3">
          {participants.map((participant) => (
            <div key={participant.socketId} className="aspect-video">
              <VideoTile
                stream={participant.stream}
                username={participant.username}
                isMuted={participant.isMuted}
                isLocal={participant.username === currentUsername}
                isSpeaking={participant.isSpeaking}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Full screen gallery mode (fallback when no video content)
  return (
    <div className={`grid ${getGridClass(participants.length)} gap-3 w-full`}>
      {participants.map((participant) => (
        <div key={participant.socketId} className={getAspectRatio(participants.length)}>
          <VideoTile
            stream={participant.stream}
            username={participant.username}
            isMuted={participant.isMuted}
            isLocal={participant.username === currentUsername}
            isSpeaking={participant.isSpeaking}
          />
        </div>
      ))}
    </div>
  )
}