'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Flame, TrendingUp, CheckCircle } from 'lucide-react'
import type { LeadData } from './types'

interface LeadScoringProps {
  visible: boolean
  lead: LeadData
  currentScore: number
}

export function LeadScoring({ visible, lead, currentScore }: LeadScoringProps) {
  const getTemperatureColor = (temp: string) => {
    switch (temp) {
      case 'HOT':
        return 'from-orange-500 via-red-500 to-rose-600'
      case 'WARM':
        return 'from-amber-400 via-orange-400 to-amber-500'
      case 'COLD':
        return 'from-slate-400 via-blue-400 to-slate-500'
      default:
        return 'from-slate-500 to-slate-600'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 50) return 'text-amber-400'
    return 'text-red-400'
  }

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
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/80">Clasificación del Lead</h3>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">AI Score</span>
              </div>
            </div>

            {/* Score Display */}
            <div className="relative mb-4">
              <div className="flex items-end justify-center gap-1">
                <motion.span
                  key={currentScore}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-5xl font-bold ${getScoreColor(currentScore)}`}
                >
                  {currentScore}
                </motion.span>
                <span className="text-lg text-white/40 mb-1">/100</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%)`
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${currentScore}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Temperature Badge */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${getTemperatureColor(lead.temperature)} flex items-center gap-2 shadow-lg`}
              >
                <Flame className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">{lead.temperature}</span>
              </motion.div>
            </div>

            {/* Status Details */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Prioridad', value: lead.priority },
                { label: 'Intención', value: lead.intent },
                { label: 'Estado', value: lead.status }
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="text-center p-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <p className="text-[10px] text-white/40 uppercase">{item.label}</p>
                  <p className="text-xs font-medium text-white mt-0.5">{item.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Checkmark */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-4 flex items-center justify-center gap-2 text-emerald-400"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Lead clasificado</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
