'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Scan, Zap } from 'lucide-react'

interface AIAnalysisProps {
  visible: boolean
  message: string
  highlightedWords?: string[]
}

export function AIAnalysis({ visible, message, highlightedWords = [] }: AIAnalysisProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 0 0 rgba(139, 92, 246, 0.4)',
                    '0 0 20px 5px rgba(139, 92, 246, 0.2)',
                    '0 0 0 0 rgba(139, 92, 246, 0.4)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
              >
                <Brain className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h3 className="text-lg font-semibold text-white">Agente IA</h3>
                <p className="text-xs text-violet-400">Analizando mensaje...</p>
              </div>
            </div>

            {/* Processing Animation */}
            <div className="relative mb-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-1"
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-8 rounded-full"
                    style={{
                      background: 'linear-gradient(to top, #8b5cf6, #a78bfa)'
                    }}
                    animate={{
                      scaleY: [0.3, 1, 0.5, 0.8, 0.3],
                      opacity: [0.3, 1, 0.5, 0.8, 0.3]
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.1
                    }}
                  />
                ))}
              </motion.div>

              {/* Scanning Lines */}
              <motion.div
                animate={{ y: [-50, 50] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 overflow-hidden pointer-events-none"
              >
                <div className="w-full h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              </motion.div>
            </div>

            {/* Message with Highlights */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <p className="text-sm text-white/70 leading-relaxed">
                {message.split(' ').map((word, i) => {
                  const cleanWord = word.replace(/[.,]/g, '').toLowerCase()
                  const isHighlighted = highlightedWords.some(
                    hw => cleanWord.includes(hw.toLowerCase()) || hw.toLowerCase().includes(cleanWord)
                  )
                  
                  return (
                    <motion.span
                      key={i}
                      initial={{ backgroundColor: 'transparent' }}
                      animate={isHighlighted ? {
                        backgroundColor: ['transparent', 'rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.2)']
                      } : {}}
                      transition={{ delay: i * 0.05 + 0.5, duration: 0.8 }}
                      className={`inline px-0.5 rounded ${isHighlighted ? 'text-white' : ''}`}
                    >
                      {word}{' '}
                    </motion.span>
                  )
                })}
              </p>
            </div>

            {/* Processing Indicators */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: Scan, label: 'NLP', active: true },
                { icon: Zap, label: 'Entidad', active: true },
                { icon: Brain, label: 'Intención', active: false }
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg ${
                    item.active 
                      ? 'bg-violet-500/20 border border-violet-500/30' 
                      : 'bg-white/5 border border-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.active ? 'text-violet-400' : 'text-white/30'}`} />
                  <span className={`text-[10px] ${item.active ? 'text-violet-300' : 'text-white/30'}`}>
                    {item.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
