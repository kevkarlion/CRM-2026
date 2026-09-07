'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Wrench, Box, Flag, CheckCircle, Clock, Star, Sparkles } from 'lucide-react'
import type { LeadData } from './types'

interface CRMPanelProps {
  visible: boolean
  lead: LeadData
  completedSteps?: number[]
}

export function CRMPanel({ visible, lead, completedSteps = [] }: CRMPanelProps) {
  const steps = [
    { id: 1, label: 'Mensaje recibido', icon: '💬' },
    { id: 2, label: 'Información extraída', icon: '📋' },
    { id: 3, label: 'Lead clasificado', icon: '🎯' },
    { id: 4, label: 'CRM actualizado', icon: '✅' }
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
          <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl">
            {/* CRM Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">CRM</p>
                  <p className="text-[10px] text-white/40">Gestión de clientes</p>
                </div>
              </div>
              <div className="px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-medium">Sincronizado</span>
              </div>
            </div>

            {/* New Lead Card */}
            <div className="p-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mb-3"
              >
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                  NUEVO LEAD
                </span>
              </motion.div>

              {/* Lead Info */}
              <div className="space-y-3 mb-4">
                {/* Client Name with Avatar */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{lead.client}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-bold ${
                        lead.temperature === 'HOT' ? 'text-orange-400' :
                        lead.temperature === 'WARM' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {lead.temperature === 'HOT' ? '🔥' : lead.temperature === 'WARM' ? '🌡️' : '❄️'}
                      </span>
                      <span className={`text-xs font-bold ${
                        lead.temperature === 'HOT' ? 'text-orange-400' :
                        lead.temperature === 'WARM' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {lead.temperature}
                      </span>
                      <span className="text-white/30 text-xs">—</span>
                      <span className="text-xs text-white/60">{lead.score}/100</span>
                    </div>
                  </div>
                </motion.div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Wrench, label: 'Servicio', value: lead.service },
                    { icon: Box, label: 'Equipo', value: lead.equipment },
                    { icon: Flag, label: 'Prioridad', value: lead.priority },
                    { icon: Clock, label: 'Estado', value: lead.status }
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5"
                    >
                      <item.icon className="w-3.5 h-3.5 text-white/40" />
                      <div>
                        <p className="text-[9px] text-white/40 uppercase">{item.label}</p>
                        <p className="text-xs text-white font-medium">{item.value}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Completion Steps */}
              <div className="space-y-1.5">
                {steps.map((step, i) => {
                  const isComplete = completedSteps.includes(step.id)
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.15 }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        isComplete 
                          ? 'bg-emerald-500/10 border-emerald-500/20' 
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isComplete ? 'bg-emerald-500' : 'bg-white/10'
                      }`}>
                        {isComplete ? (
                          <CheckCircle className="w-3 h-3 text-white" />
                        ) : (
                          <span className="text-[8px] text-white/40">{step.icon}</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        isComplete ? 'text-emerald-400' : 'text-white/40'
                      }`}>
                        {step.label}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
