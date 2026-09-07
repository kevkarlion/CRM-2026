'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, ArrowRight } from 'lucide-react'

interface FinalMessageProps {
  visible: boolean
  subtitle?: string
}

export function FinalMessage({ visible, subtitle = 'Automatiza la gestión de tus clientes con Inteligencia Artificial.' }: FinalMessageProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center max-w-lg mx-auto px-4"
        >
          {/* Main Message */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative mb-6"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-violet-500/30 via-purple-500/20 to-blue-500/30 rounded-full" />
            
            <h2 className="relative text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                La IA entiende.
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                El CRM actúa.
              </span>
            </h2>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-sm md:text-base text-white/60 leading-relaxed mb-8"
          >
            {subtitle}
          </motion.p>

          {/* CTA Button (optional) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <button className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              <span className="text-sm font-medium text-white">Solicitar demo</span>
              <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
