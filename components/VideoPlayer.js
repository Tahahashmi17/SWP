'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  ForwardIcon,
  BackwardIcon
} from '@heroicons/react/24/solid'
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import EmojiPicker from './EmojiPicker'
import ReactionOverlay from './ReactionOverlay'

export default function VideoPlayer({
  url,
  isHost,
  isPlaying,
  currentTime,
  onStateChange,
  reactions = [],
  onSendReaction,
  onReactionComplete
}) {
  const videoRef = useRef(null)
  const isSeekingRef = useRef(false)
  const syncTimeoutRef = useRef(null)
  const lastUpdateRef = useRef(0)
  const [showControls, setShowControls] = useState(false)
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  const [previewPosition, setPreviewPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const progressRef = useRef(null)
  const [keyboardHint, setKeyboardHint] = useState('')

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    if (onSendReaction) {
      // Random position between 10% and 90%
      const x = 10 + Math.random() * 80
      onSendReaction(emoji, x)
    }
  }

  // Show keyboard hint temporarily
  const showHint = (text) => {
    setKeyboardHint(text)
    setTimeout(() => setKeyboardHint(''), 1000)
  }

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!videoRef.current) return

      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // Prevent default for keys we handle
      const handledKeys = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'k', 'j', 'l', 'm', 'f', 'c', ',', '.']
      if (handledKeys.includes(e.key.toLowerCase()) || handledKeys.includes(e.key)) {
        e.preventDefault()
      }

      const video = videoRef.current

      // PLAYBACK CONTROLS (Host only)
      if (isHost) {
        switch(e.key.toLowerCase()) {
          case ' ':
          case 'k':
            // Play/Pause
            if (video.paused) {
              video.play()
              onStateChange(true, video.currentTime)
              showHint('▶️ Play')
            } else {
              video.pause()
              onStateChange(false, video.currentTime)
              showHint('⏸️ Pause')
            }
            break

          case 'arrowleft':
          case 'j':
            // Rewind 10s
            video.currentTime = Math.max(0, video.currentTime - 10)
            onStateChange(!video.paused, video.currentTime)
            showHint('⏪ -10s')
            break

          case 'arrowright':
          case 'l':
            // Forward 10s
            video.currentTime = Math.min(video.duration, video.currentTime + 10)
            onStateChange(!video.paused, video.currentTime)
            showHint('⏩ +10s')
            break

          case ',':
            // Previous frame (only when paused)
            if (video.paused) {
              video.currentTime = Math.max(0, video.currentTime - (1/30))
              onStateChange(false, video.currentTime)
              showHint('⏮️ Previous frame')
            }
            break

          case '.':
            // Next frame (only when paused)
            if (video.paused) {
              video.currentTime = Math.min(video.duration, video.currentTime + (1/30))
              onStateChange(false, video.currentTime)
              showHint('⏭️ Next frame')
            }
            break

          case 'home':
            // Jump to start
            video.currentTime = 0
            onStateChange(!video.paused, video.currentTime)
            showHint('⏮️ Start')
            break

          case 'end':
            // Jump to end
            video.currentTime = video.duration
            onStateChange(!video.paused, video.currentTime)
            showHint('⏭️ End')
            break
        }

        // Number keys (0-9) - Jump to percentage
        if (e.key >= '0' && e.key <= '9') {
          const percent = parseInt(e.key) / 10
          video.currentTime = video.duration * percent
          onStateChange(!video.paused, video.currentTime)
          showHint(`⏩ ${percent * 100}%`)
        }
      }

      // VOLUME CONTROLS (Everyone)
      switch(e.key.toLowerCase()) {
        case 'arrowup':
          // Volume up
          if (!isHost) e.preventDefault() // Only prevent for participants
          const newVolumeUp = Math.min(1, volume + 0.1)
          setVolume(newVolumeUp)
          setIsMuted(false)
          showHint(`🔊 ${Math.round(newVolumeUp * 100)}%`)
          break

        case 'arrowdown':
          // Volume down
          if (!isHost) e.preventDefault() // Only prevent for participants
          const newVolumeDown = Math.max(0, volume - 0.1)
          setVolume(newVolumeDown)
          if (newVolumeDown === 0) setIsMuted(true)
          showHint(`🔉 ${Math.round(newVolumeDown * 100)}%`)
          break

        case 'm':
          // Toggle mute
          setIsMuted(!isMuted)
          showHint(isMuted ? '🔊 Unmuted' : '🔇 Muted')
          break
      }

      // DISPLAY CONTROLS (Everyone)
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen()
      }

      if (e.key.toLowerCase() === 'c') {
        // Toggle captions (if available)
        const tracks = video.textTracks
        if (tracks.length > 0) {
          tracks[0].mode = tracks[0].mode === 'showing' ? 'hidden' : 'showing'
          showHint(tracks[0].mode === 'showing' ? '📝 Captions ON' : '📝 Captions OFF')
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isHost, volume, isMuted, onStateChange])

  // sync magic happens here
  const syncWithHost = () => {
    if (!videoRef.current || isHost) return

    // gotta pause fast
    if (!isPlaying && !videoRef.current.paused) {
      videoRef.current.pause()
    }

    // dont spam the sync pls
    const now = Date.now()
    if (now - lastUpdateRef.current < 200) return
    lastUpdateRef.current = now

    const timeDiff = Math.abs(videoRef.current.currentTime - currentTime)
    
    // only sync if we're way off
    if (timeDiff > 0.5) {
      videoRef.current.currentTime = currentTime
    }

    // try to play if we should be playing
    if (isPlaying && videoRef.current.paused) {
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {}) // browsers are weird sometimes
      }
    }
  }

  useEffect(() => {
    if (!videoRef.current || isHost) return
    syncWithHost()
  }, [isPlaying, currentTime, isHost])

  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const handlePlay = () => {
    if (isHost) {
      onStateChange(true, videoRef.current.currentTime)
    }
  }

  const handlePause = () => {
    if (isHost) {
      onStateChange(false, videoRef.current.currentTime)
    }
  }

  const handleTimeUpdate = () => {
    if (isHost && !isSeekingRef.current) {
      onStateChange(
        !videoRef.current.paused,
        videoRef.current.currentTime
      )
    }
  }

  const handleSeeking = () => {
    isSeekingRef.current = true
  }

  const handleSeeked = () => {
    isSeekingRef.current = false
    if (isHost) {
      onStateChange(
        !videoRef.current.paused,
        videoRef.current.currentTime
      )
    }
  }

  const handleLoadStart = () => {
    setLoading(true)
  }

  const handleCanPlay = () => {
    setLoading(false)
    if (!isHost) {
      syncWithHost()
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

  // Handle fullscreen changes
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
          showHint('⛶ Fullscreen')
        } else if (containerRef.current.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen()
          showHint('⛶ Fullscreen')
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
          showHint('⛶ Exit Fullscreen')
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
          showHint('⛶ Exit Fullscreen')
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  // time formatting helper (math is hard)
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleProgressClick = (e) => {
    if (!isHost || !videoRef.current) return

    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percent = x / bounds.width
    const newTime = percent * videoRef.current.duration
    
    videoRef.current.currentTime = newTime
    onStateChange(!videoRef.current.paused, newTime)
  }

  const handleProgressHover = (e) => {
    if (!isHost || !videoRef.current) return
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percent = (x / bounds.width) * 100
    setPreviewPosition(percent)
  }

  const handleProgressLeave = () => {
    setPreviewPosition(null)
  }

  const handleProgressDrag = (e) => {
    if (!isHost || !videoRef.current || !isDragging || !progressRef.current) return
    
    const bounds = progressRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - bounds.left), bounds.width)
    const percent = (x / bounds.width) * 100
    setPreviewPosition(percent)
    
    const newTime = (percent / 100) * videoRef.current.duration
    videoRef.current.currentTime = newTime
    onStateChange(!videoRef.current.paused, newTime)
  }

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleProgressDrag)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleProgressDrag)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (!url) {
    return (
      <div className="aspect-video bg-secondary/50 backdrop-blur-lg rounded-2xl flex items-center justify-center border border-white/10">
        <p className="text-gray-400 text-lg">
          {isHost
            ? "Upload a video to get started"
            : "Waiting for host to upload a video"}
        </p>
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
        {/* Reaction overlay */}
        <ReactionOverlay 
          reactions={reactions} 
          onReactionComplete={onReactionComplete}
        />

        {/* the actual video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={url}
          controls={false}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
        />

        {/* Keyboard hint overlay */}
        {keyboardHint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-xl text-lg font-medium pointer-events-none z-50"
          >
            {keyboardHint}
          </motion.div>
        )}

        {/* spinny loading thing */}
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* fancy controls for host */}
        {isHost ? (
          <div 
            className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-200 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              {/* progress bar with preview */}
              <div className="flex items-center gap-2 text-white text-sm">
                <span>{formatTime(videoRef.current?.currentTime || 0)}</span>
                <div 
                  ref={progressRef}
                  className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative cursor-pointer group"
                  onClick={handleProgressClick}
                  onMouseMove={handleProgressHover}
                  onMouseLeave={() => {
                    if (!isDragging) {
                      handleProgressLeave()
                    }
                  }}
                  onMouseDown={(e) => {
                    setIsDragging(true)
                    handleProgressDrag(e)
                  }}
                >
                  {/* that cool hover preview thing */}
                  {previewPosition !== null && (
                    <div 
                      className="absolute top-0 h-full bg-white/30 transition-all duration-100"
                      style={{ 
                        left: 0,
                        width: `${previewPosition}%`
                      }} 
                    />
                  )}
                  <div 
                    className="absolute inset-0 h-full w-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div 
                    className="h-full bg-accent rounded-full relative transition-all duration-150 ease-out"
                    style={{ 
                      width: `${(videoRef.current?.currentTime / videoRef.current?.duration) * 100 || 0}%` 
                    }}
                  >
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-lg" />
                  </div>
                  {/* time preview tooltip */}
                  {previewPosition !== null && (
                    <div 
                      className="absolute -top-8 bg-black/90 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md shadow-lg pointer-events-none"
                      style={{ 
                        left: `${previewPosition}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {formatTime((previewPosition / 100) * videoRef.current.duration)}
                    </div>
                  )}
                </div>
                <span>{formatTime(videoRef.current?.duration || 0)}</span>
              </div>

              {/* all the buttons n stuff */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {/* go back 10s */}
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime -= 10
                        onStateChange(!videoRef.current.paused, videoRef.current.currentTime)
                      }
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Rewind 10s (J / ←)"
                  >
                    <BackwardIcon className="w-5 h-5 text-white" />
                  </button>

                  {/* play/pause button */}
                  <button
                    onClick={() => {
                      if (!videoRef.current) return
                      if (videoRef.current.paused) {
                        videoRef.current.play()
                        onStateChange(true, videoRef.current.currentTime)
                      } else {
                        videoRef.current.pause()
                        onStateChange(false, videoRef.current.currentTime)
                      }
                    }}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    title="Play/Pause (Space / K)"
                  >
                    {!videoRef.current?.paused ? (
                      <PauseIcon className="w-6 h-6 text-white" />
                    ) : (
                      <PlayIcon className="w-6 h-6 text-white" />
                    )}
                  </button>

                  {/* skip 10s */}
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime += 10
                        onStateChange(!videoRef.current.paused, videoRef.current.currentTime)
                      }
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Forward 10s (L / →)"
                  >
                    <ForwardIcon className="w-5 h-5 text-white" />
                  </button>
                </div>

                <div className="flex-1" />

                {/* Emoji reactions */}
                <EmojiPicker onSelectEmoji={handleEmojiSelect} position="bottom" />

                {/* volume slider */}
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
                    title="Volume (↑ / ↓)"
                  />
                </div>

                {/* make it big */}
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
        ) : (
          // simple controls for participants
          <div 
            className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-200 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              {/* just show the time */}
              <div className="flex items-center gap-2 text-white text-sm">
                <span>{formatTime(videoRef.current?.currentTime || 0)}</span>
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent/50 rounded-full"
                    style={{ 
                      width: `${(videoRef.current?.currentTime / videoRef.current?.duration) * 100 || 0}%` 
                    }}
                  />
                </div>
                <span>{formatTime(videoRef.current?.duration || 0)}</span>
              </div>

              {/* basic controls */}
              <div className="flex items-center gap-4">
                <span className="text-white text-sm hidden sm:inline">
                  {isPlaying ? 'Playing' : 'Paused'} (Host controls)
                </span>

                {/* at least they can control volume */}
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
                    className="w-20 sm:w-24 accent-accent"
                    title="Volume (↑ / ↓)"
                  />
                </div>

                <div className="flex-1" />

                {/* fullscreen still works */}
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

                {/* just to show the state */}
                {isPlaying ? (
                  <PauseIcon className="w-5 h-5 text-white opacity-50" />
                ) : (
                  <PlayIcon className="w-5 h-5 text-white opacity-50" />
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Keyboard shortcuts hint - only show for host */}
      {isHost && showControls && !isFullscreen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg"
        >
          <div className="font-medium mb-1">Keyboard Shortcuts</div>
          <div className="space-y-0.5 text-gray-300">
            <div>Space/K: Play/Pause</div>
            <div>← →: Seek ±10s</div>
            <div>↑ ↓: Volume</div>
            <div>0-9: Jump to %</div>
            <div>F: Fullscreen</div>
          </div>
        </motion.div>
      )}
    </div>
  )
}