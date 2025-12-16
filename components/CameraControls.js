'use client'

import { motion } from 'framer-motion'
import { 
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  NoSymbolIcon,
  PhoneXMarkIcon
} from '@heroicons/react/24/solid'

export default function CameraControls({ 
  isCameraOn, 
  isMuted, 
  onToggleCamera, 
  onToggleMute,
  onLeaveCall 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="bg-gray-900/95 backdrop-blur-lg px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* Toggle Camera */}
          <button
            onClick={onToggleCamera}
            className={`p-4 rounded-xl transition-all ${
              isCameraOn
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraOn ? (
              <VideoCameraIcon className="w-6 h-6" />
            ) : (
              <VideoCameraSlashIcon className="w-6 h-6" />
            )}
          </button>

          {/* Toggle Mute */}
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-xl transition-all ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <NoSymbolIcon className="w-6 h-6" />
            ) : (
              <MicrophoneIcon className="w-6 h-6" />
            )}
          </button>

          {/* Leave Call */}
          <button
            onClick={onLeaveCall}
            className="p-4 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all"
            title="Leave call"
          >
            <PhoneXMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isCameraOn ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isCameraOn ? 'Camera On' : 'Camera Off'}</span>
          </div>
          <div className="w-px h-3 bg-gray-600" />
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500'}`} />
            <span>{isMuted ? 'Muted' : 'Unmuted'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}