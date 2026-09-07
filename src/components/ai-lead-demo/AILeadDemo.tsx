'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Pause, Play } from 'lucide-react'
import { MessagePanel } from './MessagePanel'
import { AIAnalysis } from './AIAnalysis'
import { ExtractedData } from './ExtractedData'
import { LeadScoring } from './LeadScoring'
import { ConnectionFlow } from './ConnectionFlow'
import { CRMPanel } from './CRMPanel'
import { FinalMessage } from './FinalMessage'
import { useAnimationSequence, type AnimationState } from './useAnimationSequence'
import { DEFAULT_CONFIG, type DemoConfig } from './types'

interface AILeadDemoProps {
  config?: DemoConfig
  autoPlay?: boolean
  loop?: boolean
  loopDelay?: number
}

export function AILeadDemo({
  config = DEFAULT_CONFIG,
  autoPlay = true,
  loop = true,
  loopDelay = 3000
}: AILeadDemoProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const { state, runSequence } = useAnimationSequence(config)

  useEffect(() => {
    if (autoPlay && !isPaused) {
      setIsPlaying(true)
      runSequence()
    }
  }, [])

  // Loop handling
  useEffect(() => {
    if (state.showFinal && loop && !isPaused) {
      const timeout = setTimeout(() => {
        runSequence()
      }, loopDelay)
      return () => clearTimeout(timeout)
    }
  }, [state.showFinal, loop, loopDelay, runSequence, isPaused])

  const handleRestart = () => {
    setIsPlaying(true)
    runSequence()
  }

  const handleTogglePause = () => {
    setIsPaused(!isPaused)
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <span className="text-white/80 text-sm font-medium">Demo interactiva</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePause}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title={isPaused ? 'Reanudar' : 'Pausar'}
            >
              {isPaused ? (
                <Play className="w-4 h-4 text-white/60" />
              ) : (
                <Pause className="w-4 h-4 text-white/60" />
              )}
            </button>
            <button
              onClick={handleRestart}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="Reiniciar"
            >
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Animation Area */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-6xl">
            {/* Desktop: Three-column layout */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Message + AI Analysis */}
              <div className="space-y-4">
                <MessagePanel
                  visible={state.showMessage}
                  message={config.message.text}
                  sender={config.message.sender}
                  timestamp={config.message.timestamp}
                />
                <AIAnalysis
                  visible={state.showAIAnalysis}
                  message={config.message.text}
                  highlightedWords={state.highlightedWords}
                />
              </div>

              {/* Center Column: Data + Scoring */}
              <div className="space-y-4">
                <ExtractedData
                  visible={state.showExtractedData}
                  lead={config.lead}
                />
                <LeadScoring
                  visible={state.showLeadScoring}
                  lead={config.lead}
                  currentScore={state.currentScore}
                />
                <ConnectionFlow
                  visible={state.showConnection}
                  leadName={config.lead.client}
                />
              </div>

              {/* Right Column: CRM + Final */}
              <div className="space-y-4">
                <CRMPanel
                  visible={state.showCRM}
                  lead={config.lead}
                  completedSteps={state.completedSteps}
                />
              </div>
            </div>

            {/* Tablet: Two-column layout */}
            <div className="hidden md:grid md:grid-cols-2 gap-6 lg:hidden items-start">
              <div className="space-y-4">
                <MessagePanel
                  visible={state.showMessage}
                  message={config.message.text}
                  sender={config.message.sender}
                  timestamp={config.message.timestamp}
                />
                <AIAnalysis
                  visible={state.showAIAnalysis}
                  message={config.message.text}
                  highlightedWords={state.highlightedWords}
                />
                <ExtractedData
                  visible={state.showExtractedData}
                  lead={config.lead}
                />
              </div>
              <div className="space-y-4">
                <LeadScoring
                  visible={state.showLeadScoring}
                  lead={config.lead}
                  currentScore={state.currentScore}
                />
                <ConnectionFlow
                  visible={state.showConnection}
                  leadName={config.lead.client}
                />
                <CRMPanel
                  visible={state.showCRM}
                  lead={config.lead}
                  completedSteps={state.completedSteps}
                />
              </div>
            </div>

            {/* Mobile: Single column */}
            <div className="md:hidden space-y-4">
              <AnimatePresence mode="wait">
                {state.showMessage && (
                  <motion.div key="message" layout>
                    <MessagePanel
                      visible={state.showMessage}
                      message={config.message.text}
                      sender={config.message.sender}
                      timestamp={config.message.timestamp}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {state.showAIAnalysis && (
                  <motion.div key="ai" layout>
                    <AIAnalysis
                      visible={state.showAIAnalysis}
                      message={config.message.text}
                      highlightedWords={state.highlightedWords}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {state.showExtractedData && (
                  <motion.div key="extracted" layout>
                    <ExtractedData
                      visible={state.showExtractedData}
                      lead={config.lead}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {state.showLeadScoring && (
                  <motion.div key="scoring" layout>
                    <LeadScoring
                      visible={state.showLeadScoring}
                      lead={config.lead}
                      currentScore={state.currentScore}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {state.showConnection && (
                  <motion.div key="connection" layout>
                    <ConnectionFlow
                      visible={state.showConnection}
                      leadName={config.lead.client}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {state.showCRM && (
                  <motion.div key="crm" layout>
                    <CRMPanel
                      visible={state.showCRM}
                      lead={config.lead}
                      completedSteps={state.completedSteps}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Final Message - Full width */}
            <div className="mt-8">
              <FinalMessage
                visible={state.showFinal}
                subtitle="Automatiza la gestión de tus clientes con Inteligencia Artificial."
              />
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 border-t border-white/5">
          <div className="flex items-center justify-center gap-2">
            {[
              { key: 'msg', label: 'Mensaje', active: state.showMessage },
              { key: 'ai', label: 'IA', active: state.showAIAnalysis },
              { key: 'data', label: 'Datos', active: state.showExtractedData },
              { key: 'score', label: 'Score', active: state.showLeadScoring },
              { key: 'sync', label: 'Sincronizar', active: state.showConnection },
              { key: 'crm', label: 'CRM', active: state.showCRM },
              { key: 'end', label: 'Listo', active: state.showFinal }
            ].map((step) => (
              <div key={step.key} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  step.active ? 'bg-violet-500' : 'bg-white/20'
                }`} />
                <span className={`text-[10px] ${
                  step.active ? 'text-white/80' : 'text-white/30'
                } hidden sm:inline`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_CONFIG } from './types'
export type { DemoConfig, LeadData } from './types'
