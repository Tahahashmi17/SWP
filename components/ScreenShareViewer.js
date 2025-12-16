'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid'
import { 
  ArrowsPointingOutIcon, 
  ArrowsPointingInIcon,
  SignalSlashIcon
} from '@heroicons/react/24/outline'

export default function ScreenShareViewer({ 
  stream, 
  isHost,
  onStopSharing 
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [connectionState, setConnectionState] = useState('connecting')

  // Set stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      setConnectionState('connected')

      // Handle stream end (when host stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        console.log('📺 Screen share ended')
        if (isHost && onStopSharing) {
          onStopSharing()
        }
      }
    }
  }, [stream, isHost, onStopSharing])

  // Handle volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        } else if (containerRef.current.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  if (!stream) {
    return (
      <div className="aspect-video bg-secondary/50 backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center border border-white/10 gap-4">
        <SignalSlashIcon className="w-16 h-16 text-gray-400 animate-pulse" />
        <p className="text-gray-400 text-lg">Connecting to screen share...</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative group ${isFullscreen ? 'fixed inset-0 bg-black z-50' : ''}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`relative ${isFullscreen ? 'h-full' : 'aspect-video'} bg-black rounded-2xl overflow-hidden`}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Connection indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
          }`} />
          <span className="text-white text-sm">
            {connectionState === 'connected' ? 'Live' : 'Connecting...'}
          </span>
        </div>

        {/* Host indicator */}
        {isHost && (
          <div className="absolute top-4 right-4 bg-accent/80 backdrop-blur-md px-3 py-2 rounded-lg">
            <span className="text-white text-sm font-medium">You're presenting</span>
          </div>
        )}

        {/* Controls overlay */}
        <div 
          className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-4">
              {/* Stop sharing (host only) */}
              {isHost && onStopSharing && (
                <button
                  onClick={onStopSharing}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                >
                  Stop Sharing
                </button>
              )}

              <span className="text-white text-sm">
                {isHost ? 'Sharing your screen' : 'Viewing screen share'}
              </span>

              <div className="flex-1" />

              {/* Volume control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Mute (M)"
                >
                  {isMuted || volume === 0 ? (
                    <SpeakerXMarkIcon className="w-5 h-5 text-white" />
                  ) : (
                    <SpeakerWaveIcon className="w-5 h-5 text-white" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-accent"
                  title="Volume"
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="w-5 h-5 text-white" />
                ) : (
                  <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}