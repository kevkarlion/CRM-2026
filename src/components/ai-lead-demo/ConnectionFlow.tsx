'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Database, Sparkles } from 'lucide-react'

interface ConnectionFlowProps {
  visible: boolean
  leadName: string
}

export function ConnectionFlow({ visible, leadName }: ConnectionFlowProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Connection Line */}
          <div className="relative py-8">
            {/* Animated particles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-0.5"
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: i % 2 === 0 ? '#8b5cf6' : '#a78bfa'
                    }}
                    animate={{
                      y: [-20, 20],
                      opacity: [0, 1, 0],
                      scale: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: 'easeInOut'
                    }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Main Flow Line */}
            <div className="relative flex items-center justify-center gap-4">
              {/* Source: AI Agent */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-violet-300 font-medium">Agente IA</span>
              </motion.div>

              {/* Arrow */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5 text-white/40" />
                </motion.div>
              </motion.div>

              {/* Target: CRM */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40"
              >
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">CRM</span>
              </motion.div>
            </div>

            {/* Data Packet Animation */}
            <motion.div
              initial={{ left: '25%', opacity: 0 }}
              animate={{ left: '75%', opacity: 1 }}
              transition={{ 
                duration: 1.5, 
                ease: 'easeInOut',
                delay: 0.5
              }}
              className="absolute top-1/2 -translate-y-1/2 left-1/4"
            >
              <div className="w-16 h-8 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <motion.div
                  animate={{ scale: [0.8, 1.1, 0.8] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="px-2 py-1 rounded bg-white/20"
                >
                  <span className="text-[8px] font-bold text-white">{leadName}</span>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Processing Steps */}
          <div className="flex justify-center gap-4 mt-2">
            {['Analizando', 'Clasificando', 'Enviando', 'Guardando'].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.2 }}
                className="flex items-center gap-1.5"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="text-[10px] text-white/50">{step}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
