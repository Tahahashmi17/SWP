-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "videoType" TEXT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "currentTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "socketId" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE INDEX "Room_roomId_idx" ON "Room"("roomId");

-- CreateIndex
CREATE INDEX "RoomUser_roomId_idx" ON "RoomUser"("roomId");

-- CreateIndex
CREATE INDEX "RoomUser_socketId_idx" ON "RoomUser"("socketId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomUser_roomId_username_key" ON "RoomUser"("roomId", "username");

-- CreateIndex
CREATE INDEX "Message_roomId_idx" ON "Message"("roomId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- AddForeignKey
ALTER TABLE "RoomUser" ADD CONSTRAINT "RoomUser_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_username_fkey" FOREIGN KEY ("roomId", "username") REFERENCES "RoomUser"("roomId", "username") ON DELETE CASCADE ON UPDATE CASCADE;
