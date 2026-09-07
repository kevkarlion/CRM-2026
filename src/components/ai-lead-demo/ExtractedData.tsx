'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, Box, Flag, Target, MapPin, User } from 'lucide-react'
import type { LeadData } from './types'

interface ExtractedDataProps {
  visible: boolean
  lead: LeadData
}

interface DataCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  delay: number
  color: string
}

function DataCard({ icon: Icon, label, value, delay, color }: DataCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] text-white/50 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-white">{value}</p>
      </div>
    </motion.div>
  )
}

export function ExtractedData({ visible, lead }: ExtractedDataProps) {
  const dataCards: DataCardProps[] = [
    { icon: User, label: 'Cliente', value: lead.client, delay: 0, color: 'bg-blue-500' },
    { icon: Wrench, label: 'Servicio', value: lead.service, delay: 0.1, color: 'bg-orange-500' },
    { icon: Box, label: 'Equipo', value: lead.equipment, delay: 0.2, color: 'bg-cyan-500' },
    { icon: Flag, label: 'Prioridad', value: lead.priority, delay: 0.3, color: 'bg-red-500' },
    { icon: Target, label: 'Intención', value: lead.intent, delay: 0.4, color: 'bg-violet-500' },
    { icon: MapPin, label: 'Ubicación', value: lead.location, delay: 0.5, color: 'bg-emerald-500' }
  ]

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
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-medium text-white/80">Información extraída</h3>
            </div>

            {/* Data Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              {dataCards.map((card, i) => (
                <DataCard key={card.label} {...card} />
              ))}
            </div>

            {/* Extraction Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 flex items-center justify-center gap-2 text-emerald-400"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                ✓
              </motion.div>
              <span className="text-xs font-medium">Datos estructurados</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
