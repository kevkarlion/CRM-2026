'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Check } from 'lucide-react'

interface MessagePanelProps {
  visible: boolean
  message: string
  sender: string
  timestamp: string
}

export function MessagePanel({ visible, message, sender, timestamp }: MessagePanelProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{sender}</p>
                  <p className="text-xs text-emerald-400">En línea</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/30" />
              </div>
            </div>

            {/* Chat Messages */}
            <div className="p-4 space-y-4 min-h-[180px]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[10px] font-bold text-white">JP</span>
                </div>
                <div className="flex-1">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="bg-white/10 rounded-2xl rounded-tl-md px-4 py-3"
                  >
                    <p className="text-sm text-white/90 leading-relaxed">{message}</p>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-[10px] text-white/40 mt-1.5 ml-1"
                  >
                    {timestamp}
                  </motion.p>
                </div>
              </motion.div>

              {/* Typing Indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="flex gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <Send className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-white/40"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* New Message Notification */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Mensaje recibido</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
