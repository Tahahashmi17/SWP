const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testConnection() {
  try {
    // Create a test room
    const room = await prisma.room.create({
      data: {
        roomId: 'test-' + Date.now(),
        hostId: 'test-user'
      }
    })
    
    console.log('✅ Database connected successfully!')
    console.log('Created test room:', room)
    
    // Create a test user
    const user = await prisma.roomUser.create({
      data: {
        roomId: room.roomId,
        username: 'TestUser',
        isHost: true
      }
    })
    
    console.log('✅ Created test user:', user)
    
    // Clean up
    await prisma.roomUser.delete({ where: { id: user.id } })
    await prisma.room.delete({ where: { id: room.id } })
    
    console.log('✅ Test cleanup complete! Database is working perfectly!')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()