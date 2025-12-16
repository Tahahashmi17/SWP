'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'
import VideoPlayer from '../../../components/VideoPlayer'
import ChatPanel from '../../../components/ChatPanel'
import ScreenShareViewer from '../../../components/ScreenShareViewer'
import VideoGallery from '../../../components/VideoGallery'
import CameraControls from '../../../components/CameraControls'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/solid'
import Peer from 'simple-peer'

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
  : 'http://localhost:3001'

function Toast({ message, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-lg text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export default function RoomPage({ params }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const username = searchParams.get('username')
  const isHost = searchParams.get('isHost') === 'true'
  const { roomId } = params
  
  const [users, setUsers] = useState([])
  const [videoUrl, setVideoUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedSize, setUploadedSize] = useState(0)
  const [totalSize, setTotalSize] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState([])
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Reaction state
  const [reactions, setReactions] = useState([])

  // Screen share state
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenStream, setScreenStream] = useState(null)
  const screenPeersRef = useRef([])
  const screenStreamRef = useRef(null)

  // Camera state (Google Meet style)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraParticipants, setCameraParticipants] = useState([])
  const cameraStreamRef = useRef(null)
  const cameraPeersRef = useRef({})

  useEffect(() => {
    if (!username) {
      router.replace('/')
      return
    }

    socketRef.current = io(SOCKET_URL)
    
    socketRef.current.emit('check-room', { roomId }, (response) => {
      if (!isHost && !response.exists) {
        setError('This room does not exist')
        socketRef.current.disconnect()
        setTimeout(() => router.replace('/'), 2000)
        return
      }
      
      if (!isHost && !response.hasHost) {
        setError('Cannot join a room without a host')
        socketRef.current.disconnect()
        setTimeout(() => router.replace('/'), 2000)
        return
      }

      socketRef.current.emit('join-room', {
        roomId,
        username,
        isHost
      }, (response) => {
        if (response.error) {
          setError(response.error)
          socketRef.current.disconnect()
          setTimeout(() => router.replace('/'), 2000)
          return
        }
      })
    })

    socketRef.current.on('user-joined', (users) => {
      setUsers(users)
    })

    socketRef.current.on('user-left', (users) => {
      setUsers(users)
    })

    socketRef.current.on('video-uploaded', (data) => {
      const url = typeof data === 'string' ? data : data.url
      setVideoUrl(url)
    })

    socketRef.current.on('video-state-change', ({ isPlaying, currentTime }) => {
      setIsPlaying(isPlaying)
      setCurrentTime(currentTime)
    })

    socketRef.current.on('room-closed', ({ message }) => {
      setError(message)
      setTimeout(() => router.replace('/'), 2000)
    })

    socketRef.current.on('chat-history', (history) => {
      setMessages(history)
    })

    socketRef.current.on('new-message', (message) => {
      setMessages(prev => [...prev, message])
    })

    socketRef.current.on('new-reaction', (reaction) => {
      setReactions(prev => [...prev, reaction])
    })

    // Screen share events
    socketRef.current.on('screen-share-started', ({ hostSocketId }) => {
      setIsScreenSharing(true)
      if (!isHost) {
        const peer = createScreenPeer(hostSocketId, true)
      }
    })

    socketRef.current.on('screen-share-stopped', () => {
      handleStopScreenShare()
    })

    // Camera events (multi-user)
    socketRef.current.on('user-camera-started', ({ socketId, username: peerUsername }) => {
      console.log(`📹 ${peerUsername} started camera`)
      createCameraPeer(socketId, peerUsername, true)
    })

    socketRef.current.on('user-camera-stopped', ({ socketId, username: peerUsername }) => {
      console.log(`📹 ${peerUsername} stopped camera`)
      setCameraParticipants(prev => prev.filter(p => p.socketId !== socketId))
      
      if (cameraPeersRef.current[socketId]) {
        cameraPeersRef.current[socketId].destroy()
        delete cameraPeersRef.current[socketId]
      }
    })

    socketRef.current.on('user-audio-toggled', ({ socketId, username: peerUsername, isMuted }) => {
      setCameraParticipants(prev => 
        prev.map(p => p.socketId === socketId ? { ...p, isMuted } : p)
      )
    })

    // WebRTC signaling
    socketRef.current.on('webrtc-offer', async ({ from, offer }) => {
      console.log('📡 Received offer from:', from)
      if (isHost && isScreenSharing) {
        const peer = createScreenPeer(from, false)
        peer.signal(offer)
      }
      if (isCameraOn) {
        const peer = createCameraPeer(from, null, false)
        peer.signal(offer)
      }
    })

    socketRef.current.on('webrtc-answer', async ({ from, answer }) => {
      console.log('📡 Received answer from:', from)
      const screenPeer = screenPeersRef.current.find(p => p.peerId === from)
      if (screenPeer) {
        screenPeer.peer.signal(answer)
      }
      const cameraPeer = cameraPeersRef.current[from]
      if (cameraPeer) {
        cameraPeer.signal(answer)
      }
    })

    socketRef.current.on('webrtc-ice-candidate', async ({ from, candidate }) => {
      const screenPeer = screenPeersRef.current.find(p => p.peerId === from)
      if (screenPeer && candidate) {
        try {
          screenPeer.peer.signal(candidate)
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
        }
      }
      const cameraPeer = cameraPeersRef.current[from]
      if (cameraPeer && candidate) {
        try {
          cameraPeer.signal(candidate)
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
        }
      }
    })

    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
      }
      screenPeersRef.current.forEach(({ peer }) => peer.destroy())
      Object.values(cameraPeersRef.current).forEach(peer => peer.destroy())
      socketRef.current.disconnect()
    }
  }, [roomId, username, isHost, router])

  // Screen share peer
  const createScreenPeer = (peerId, initiator) => {
    const peer = new Peer({
      initiator,
      stream: screenStreamRef.current,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    })

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketRef.current.emit('webrtc-offer', { to: peerId, offer: data })
      } else if (data.type === 'answer') {
        socketRef.current.emit('webrtc-answer', { to: peerId, answer: data })
      } else {
        socketRef.current.emit('webrtc-ice-candidate', { to: peerId, candidate: data })
      }
    })

    peer.on('stream', (stream) => {
      setScreenStream(stream)
    })

    peer.on('error', (err) => console.error('Screen peer error:', err))
    peer.on('close', () => {
      screenPeersRef.current = screenPeersRef.current.filter(p => p.peerId !== peerId)
    })

    screenPeersRef.current.push({ peerId, peer })
    return peer
  }

  // Camera peer (for each participant)
  const createCameraPeer = (peerId, peerUsername, initiator) => {
    const peer = new Peer({
      initiator,
      stream: cameraStreamRef.current,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    })

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketRef.current.emit('webrtc-offer', { to: peerId, offer: data })
      } else if (data.type === 'answer') {
        socketRef.current.emit('webrtc-answer', { to: peerId, answer: data })
      } else {
        socketRef.current.emit('webrtc-ice-candidate', { to: peerId, candidate: data })
      }
    })

    peer.on('stream', (stream) => {
      console.log(`📹 Received camera stream from ${peerUsername}`)
      setCameraParticipants(prev => {
        const exists = prev.find(p => p.socketId === peerId)
        if (exists) return prev
        return [...prev, { 
          socketId: peerId, 
          username: peerUsername, 
          stream, 
          isMuted: false 
        }]
      })
    })

    peer.on('error', (err) => console.error('Camera peer error:', err))
    peer.on('close', () => {
      delete cameraPeersRef.current[peerId]
      setCameraParticipants(prev => prev.filter(p => p.socketId !== peerId))
    })

    cameraPeersRef.current[peerId] = peer
    return peer
  }

  const handleVideoUpload = async (file) => {
    if (!isHost || !socketRef.current) return
    
    const formData = new FormData()
    formData.append('video', file)
    
    setIsUploading(true)
    setUploadProgress(0)
    setUploadedSize(0)
    setTotalSize(file.size)

    try {
      socketRef.current.emit('start-upload')
      socketRef.current.on('upload-progress', ({ progress, uploaded, total }) => {
        setUploadProgress(progress)
        setUploadedSize(uploaded)
        setTotalSize(total)
      })

      const response = await fetch(`${SOCKET_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Socket-ID': socketRef.current.id }
      })
      
      if (!response.ok) throw new Error('Upload failed')

      const { url } = await response.json()
      setVideoUrl(url)
      socketRef.current.emit('video-uploaded', { roomId, url, type: 'upload' })
      socketRef.current.off('upload-progress')
      
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 1000)
    } catch (error) {
      setError(error.message)
      setIsUploading(false)
      socketRef.current.off('upload-progress')
    }
  }

  const handleVideoStateChange = (isPlaying, currentTime) => {
    if (!isHost) return
    socketRef.current.emit('video-state-change', { roomId, isPlaying, currentTime })
  }

  const handleSendMessage = (message) => {
    if (!socketRef.current || !message.trim()) return
    socketRef.current.emit('send-message', { roomId, username, message: message.trim() })
  }

  const handleSendReaction = (emoji, x) => {
    if (!socketRef.current) return
    socketRef.current.emit('send-reaction', { roomId, emoji, x, y: 0 })
  }

  const handleReactionComplete = (reactionId) => {
    setReactions(prev => prev.filter(r => r.id !== reactionId))
  }

  const handleStartScreenShare = async () => {
    if (!isHost) return
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: { echoCancellation: true }
      })

      screenStreamRef.current = stream
      setScreenStream(stream)
      setIsScreenSharing(true)
      socketRef.current.emit('start-screen-share', { roomId })

      stream.getVideoTracks()[0].onended = () => handleStopScreenShare()
    } catch (error) {
      setError('Failed to start screen sharing')
    }
  }

  const handleStopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }
    setScreenStream(null)
    setIsScreenSharing(false)
    screenPeersRef.current.forEach(({ peer }) => peer.destroy())
    screenPeersRef.current = []
    if (isHost) socketRef.current.emit('stop-screen-share', { roomId })
  }

  const handleToggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        })

        cameraStreamRef.current = stream
        setIsCameraOn(true)
        socketRef.current.emit('start-camera', { roomId, username })

        setCameraParticipants(prev => [...prev, {
          socketId: socketRef.current.id,
          username,
          stream,
          isMuted: false
        }])

        stream.getVideoTracks()[0].onended = () => {
          setIsCameraOn(false)
          socketRef.current.emit('stop-camera', { roomId, username })
        }
      } catch (error) {
        setError('Failed to access camera')
      }
    } else {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
        cameraStreamRef.current = null
      }
      setIsCameraOn(false)
      socketRef.current.emit('stop-camera', { roomId, username })
      setCameraParticipants(prev => prev.filter(p => p.username !== username))
      Object.values(cameraPeersRef.current).forEach(peer => peer.destroy())
      cameraPeersRef.current = {}
    }
  }

  const handleToggleMute = () => {
    if (cameraStreamRef.current) {
      const audioTrack = cameraStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
        socketRef.current.emit('toggle-audio', { roomId, username, isMuted: !audioTrack.enabled })
        setCameraParticipants(prev =>
          prev.map(p => p.username === username ? { ...p, isMuted: !audioTrack.enabled } : p)
        )
      }
    }
  }

  const handleLeaveCall = () => {
    if (isCameraOn) {
      handleToggleCamera()
    }
  }

  const handleLeaveRoom = () => {
    if (isCameraOn) handleToggleCamera()
    socketRef.current.disconnect()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-primary to-purple-900">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-screen"
      >
        <Sidebar 
          users={users}
          currentUser={username}
          isHost={isHost}
          onVideoUpload={handleVideoUpload}
          roomId={roomId}
          onLeave={handleLeaveRoom}
          uploadProgress={uploadProgress}
          uploadedSize={uploadedSize}
          totalSize={totalSize}
          isUploading={isUploading}
          onStartScreenShare={handleStartScreenShare}
          isScreenSharing={isScreenSharing}
        />
        
        <main className="flex-1 p-4 sm:p-8 pb-32">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {/* Main Content Area */}
              {isScreenSharing ? (
                <ScreenShareViewer
                  stream={screenStream}
                  isHost={isHost}
                  onStopSharing={handleStopScreenShare}
                />
              ) : videoUrl ? (
                <VideoPlayer
                  url={videoUrl}
                  isHost={isHost}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  onStateChange={handleVideoStateChange}
                  reactions={reactions}
                  onSendReaction={handleSendReaction}
                  onReactionComplete={handleReactionComplete}
                />
              ) : cameraParticipants.length > 0 ? (
                // If no video/screen, show cameras in full gallery
                <VideoGallery
                  participants={cameraParticipants}
                  currentUsername={username}
                  sidebarMode={false}
                />
              ) : (
                // Nothing active - show placeholder
                <div className="aspect-video bg-secondary/50 backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center border border-white/10 gap-4">
                  <div className="text-center">
                    <p className="text-gray-400 text-lg mb-2">No content being shared</p>
                    <p className="text-gray-500 text-sm">Upload a video, share screen, or turn on camera</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Floating Camera Sidebar - shows when there's other content */}
          {cameraParticipants.length > 0 && (videoUrl || isScreenSharing) && (
            <VideoGallery
              participants={cameraParticipants}
              currentUsername={username}
              sidebarMode={true}
            />
          )}
        </main>

        {/* Camera Controls */}
        <CameraControls
          isCameraOn={isCameraOn}
          isMuted={isMuted}
          onToggleCamera={handleToggleCamera}
          onToggleMute={handleToggleMute}
          onLeaveCall={handleLeaveCall}
        />

        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUser={username}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />
      </motion.div>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-indigo-500/20 via-transparent to-transparent blur-3xl" />
      </div>

      <AnimatePresence>
        {error && <Toast message={error} onClose={() => setError('')} />}
      </AnimatePresence>
    </div>
  )
}