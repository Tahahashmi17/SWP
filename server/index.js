const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const multer = require('multer')
const path = require('path')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()
const server = http.createServer(app)

const isDev = process.env.NODE_ENV !== 'production'
const PORT = process.env.PORT || 3001
const FRONTEND_URL = isDev ? 'http://localhost:3000' : process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`

const io = new Server(server, {
  cors: {
    origin: isDev ? FRONTEND_URL : [FRONTEND_URL, /\.onrender\.com$/],
    methods: ['GET', 'POST']
  }
})

app.use(cors({
  origin: isDev ? FRONTEND_URL : [FRONTEND_URL, /\.onrender\.com$/],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Socket-ID']
}))

const uploadProgress = new Map()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Not a video file'))
    }
  }
})

const fs = require('fs')
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

app.use('/uploads', express.static('uploads'))

// Helper: Get room with users
async function getRoomWithUsers(roomId) {
  return await prisma.room.findUnique({
    where: { roomId },
    include: {
      users: {
        select: {
          username: true,
          isHost: true,
          socketId: true
        }
      }
    }
  })
}

// Helper: Check if room has host
function roomHasHost(room) {
  return room && room.users.some(user => user.isHost)
}

// Cleanup inactive rooms (run periodically)
async function cleanupInactiveRooms() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
  
  await prisma.room.deleteMany({
    where: {
      updatedAt: { lt: thirtyMinutesAgo }
    }
  })
}

// Run cleanup every 10 minutes
setInterval(cleanupInactiveRooms, 10 * 60 * 1000)

io.on('connection', (socket) => {
  let currentRoom = null
  let currentUser = null

  socket.on('start-upload', () => {
    uploadProgress.set(socket.id, 0)
  })

  socket.on('check-room', async ({ roomId }, callback) => {
    const room = await getRoomWithUsers(roomId)
    callback({
      exists: room !== null,
      hasHost: roomHasHost(room)
    })
  })

  socket.on('join-room', async ({ roomId, username, isHost }, callback) => {
    try {
      let room = await getRoomWithUsers(roomId)
      
      // Validation
      if (!room && !isHost) {
        callback({ error: 'Room does not exist' })
        return
      }

      if (room && !roomHasHost(room) && !isHost) {
        callback({ error: 'Cannot join room without a host' })
        return
      }

      if (room && isHost && roomHasHost(room)) {
        callback({ error: 'Room already has a host' })
        return
      }

      if (room && room.users.some(user => user.username === username)) {
        callback({ error: 'Username is already taken in this room' })
        return
      }

      currentRoom = roomId
      currentUser = { username, isHost }

      socket.join(roomId)

      // Create room if it doesn't exist
      if (!room) {
        room = await prisma.room.create({
          data: {
            roomId,
            hostId: username,
            users: {
              create: {
                username,
                isHost,
                socketId: socket.id
              }
            }
          },
          include: {
            users: {
              select: {
                username: true,
                isHost: true
              }
            }
          }
        })
      } else {
        // Add user to existing room
        await prisma.roomUser.create({
          data: {
            roomId,
            username,
            isHost,
            socketId: socket.id
          }
        })

        // Refresh room data
        room = await getRoomWithUsers(roomId)
      }

      // Send user list to everyone
      io.to(roomId).emit('user-joined', room.users)

      // Catch new user up with current video state
      if (room.videoUrl) {
        socket.emit('video-uploaded', {
          url: room.videoUrl,
          type: room.videoType || 'upload'
        })
        socket.emit('video-state-change', {
          isPlaying: room.isPlaying,
          currentTime: room.currentTime
        })
      }

      // Send recent messages (last 50)
      const messages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          username: true,
          content: true,
          type: true,
          createdAt: true
        }
      })
      socket.emit('chat-history', messages.reverse())

      callback({ success: true })
    } catch (error) {
      console.error('Join room error:', error)
      callback({ error: 'Failed to join room' })
    }
  })

  socket.on('disconnect', async () => {
    uploadProgress.delete(socket.id)

    if (currentRoom && currentUser) {
      try {
        // Remove user from database
        await prisma.roomUser.delete({
          where: {
            roomId_username: {
              roomId: currentRoom,
              username: currentUser.username
            }
          }
        })

        const room = await getRoomWithUsers(currentRoom)

        // If no host or no users, delete room
        if (!room || room.users.length === 0 || !roomHasHost(room)) {
          io.to(currentRoom).emit('room-closed', { 
            message: 'Room was closed because the host left' 
          })
          io.in(currentRoom).disconnectSockets()
          
          if (room) {
            await prisma.room.delete({ where: { roomId: currentRoom } })
          }
        } else {
          // Notify others user left
          io.to(currentRoom).emit('user-left', room.users)
        }
      } catch (error) {
        console.error('Disconnect error:', error)
      }
    }
  })

  // Video upload
  socket.on('video-uploaded', async ({ roomId, url, type = 'upload' }) => {
    try {
      await prisma.room.update({
        where: { roomId },
        data: {
          videoUrl: url,
          videoType: type,
          isPlaying: false,
          currentTime: 0
        }
      })

      io.to(roomId).emit('video-uploaded', { url, type })
    } catch (error) {
      console.error('Video upload error:', error)
    }
  })

  // Video state change
  socket.on('video-state-change', async ({ roomId, isPlaying, currentTime }) => {
    try {
      await prisma.room.update({
        where: { roomId },
        data: { isPlaying, currentTime }
      })

      socket.to(roomId).emit('video-state-change', { isPlaying, currentTime })
    } catch (error) {
      console.error('Video state error:', error)
    }
  })

  // Chat message
  socket.on('send-message', async ({ roomId, username, message }) => {
    try {
      const newMessage = await prisma.message.create({
        data: {
          roomId,
          username,
          content: message,
          type: 'text'
        }
      })

      io.to(roomId).emit('new-message', {
        username: newMessage.username,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt
      })
    } catch (error) {
      console.error('Send message error:', error)
    }
  })

  // Emoji reaction
  socket.on('send-reaction', ({ roomId, emoji, x, y }) => {
    const reactionId = `${socket.id}-${Date.now()}`
    io.to(roomId).emit('new-reaction', { 
      id: reactionId,
      emoji, 
      x, 
      y 
    })
  })

  // Screen sharing events
  socket.on('start-screen-share', async ({ roomId }) => {
    try {
      // Notify all participants that host is sharing screen
      socket.to(roomId).emit('screen-share-started', {
        hostSocketId: socket.id
      })

      // Update room to indicate screen sharing is active
      await prisma.room.update({
        where: { roomId },
        data: {
          videoUrl: 'screen-share',
          videoType: 'screen'
        }
      })
    } catch (error) {
      console.error('Start screen share error:', error)
    }
  })

  socket.on('stop-screen-share', async ({ roomId }) => {
    try {
      // Notify all participants that screen sharing stopped
      io.to(roomId).emit('screen-share-stopped')

      // Clear video URL
      await prisma.room.update({
        where: { roomId },
        data: {
          videoUrl: null,
          videoType: null
        }
      })
    } catch (error) {
      console.error('Stop screen share error:', error)
    }
  })

  // Camera sharing events (multi-user support)
  socket.on('start-camera', async ({ roomId, username }) => {
    try {
      console.log(`📹 ${username} started camera`)
      
      // Notify all other participants
      socket.to(roomId).emit('user-camera-started', {
        socketId: socket.id,
        username
      })

      // Update user's camera status in database
      await prisma.roomUser.update({
        where: {
          roomId_username: {
            roomId,
            username
          }
        },
        data: {
          socketId: socket.id
        }
      })
    } catch (error) {
      console.error('Start camera error:', error)
    }
  })

  socket.on('stop-camera', ({ roomId, username }) => {
    console.log(`📹 ${username} stopped camera`)
    io.to(roomId).emit('user-camera-stopped', {
      socketId: socket.id,
      username
    })
  })

  socket.on('toggle-audio', ({ roomId, username, isMuted }) => {
    console.log(`🎤 ${username} ${isMuted ? 'muted' : 'unmuted'} audio`)
    socket.to(roomId).emit('user-audio-toggled', {
      socketId: socket.id,
      username,
      isMuted
    })
  })

  // WebRTC signaling
  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', {
      from: socket.id,
      offer
    })
  })

  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', {
      from: socket.id,
      answer
    })
  })

  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('webrtc-ice-candidate', {
      from: socket.id,
      candidate
    })
  })
})

app.post('/upload', (req, res) => {
  const socketId = req.headers['x-socket-id']
  if (!socketId) {
    return res.status(400).json({ error: 'Socket ID is required' })
  }
  
  let uploaded = 0
  const total = parseInt(req.headers['content-length'])
  if (!total) {
    return res.status(400).json({ error: 'Content-Length header is required' })
  }
  
  req.on('data', (chunk) => {
    uploaded += chunk.length
    const progress = Math.round((uploaded / total) * 100)
    
    if (socketId && uploadProgress.get(socketId) !== progress) {
      uploadProgress.set(socketId, progress)
      io.to(socketId).emit('upload-progress', { 
        progress,
        uploaded,
        total
      })
    }
  })

  upload.single('video')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err)
      return res.status(400).json({ error: err.message })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const url = `${isDev ? 'http://localhost:' + PORT : FRONTEND_URL}/uploads/${req.file.filename}`
    console.log('Upload successful:', url)
    res.json({ url })
  })
})

// Start server function
async function startServer() {
  try {
    // In production, serve Next.js from standalone build
    if (!isDev) {
      console.log('Setting up Next.js standalone server...')
      
      // Serve static files from Next.js build
      app.use('/_next/static', express.static(path.join(__dirname, '../.next/static')))
      app.use('/static', express.static(path.join(__dirname, '../public')))
      
      // For standalone builds, we need to require the Next.js server
      const nextHandler = require('../.next/standalone/server.js')
      
      // Route all other requests to Next.js
      app.all('*', (req, res) => {
        // Next.js standalone server handles the request
        return nextHandler(req, res)
      })
      
      console.log('Next.js standalone ready!')
    }

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`Environment: ${isDev ? 'development' : 'production'}`)
      console.log(`Frontend URL: ${FRONTEND_URL}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    // In production, try alternative Next.js integration
    if (!isDev) {
      console.log('Trying alternative Next.js integration...')
      const next = require('next')
      const nextApp = next({
        dev: false,
        dir: path.join(__dirname, '..')
      })
      const handle = nextApp.getRequestHandler()

      await nextApp.prepare()
      
      app.all('*', (req, res) => {
        return handle(req, res)
      })
      
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT} (fallback mode)`)
      })
    } else {
      process.exit(1)
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Start the server
startServer()