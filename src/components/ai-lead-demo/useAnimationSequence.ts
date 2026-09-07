'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DemoConfig } from './types'

export interface AnimationState {
  // Scene visibility
  showMessage: boolean
  showAIAnalysis: boolean
  showExtractedData: boolean
  showLeadScoring: boolean
  showConnection: boolean
  showCRM: boolean
  showFinal: boolean
  
  // Data
  currentScore: number
  completedSteps: number[]
  highlightedWords: string[]
}

export function useAnimationSequence(config: DemoConfig) {
  const [state, setState] = useState<AnimationState>({
    showMessage: false,
    showAIAnalysis: false,
    showExtractedData: false,
    showLeadScoring: false,
    showConnection: false,
    showCRM: false,
    showFinal: false,
    currentScore: 0,
    completedSteps: [],
    highlightedWords: []
  })

  const runSequence = useCallback(() => {
    const {
      timing,
      lead
    } = config

    // Reset state
    setState({
      showMessage: false,
      showAIAnalysis: false,
      showExtractedData: false,
      showLeadScoring: false,
      showConnection: false,
      showCRM: false,
      showFinal: false,
      currentScore: 0,
      completedSteps: [],
      highlightedWords: []
    })

    // Scene 1: Message appears
    setTimeout(() => {
      setState(prev => ({ ...prev, showMessage: true }))
    }, timing.messageDelay)

    // Scene 2: AI detects and analyzes
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        showAIAnalysis: true,
        highlightedWords: ['reparar', 'aire', 'acondicionado', 'enfriando', 'posible']
      }))
    }, timing.aiDetectionDelay)

    // Scene 3: Data extraction
    setTimeout(() => {
      setState(prev => ({ ...prev, showExtractedData: true }))
    }, timing.extractionDelay)

    // Scene 4: Lead scoring (with animated score)
    setTimeout(() => {
      setState(prev => ({ ...prev, showLeadScoring: true }))
      
      // Animate score from 0 to target
      const scoreDuration = 1500
      const scoreSteps = 20
      const stepDuration = scoreDuration / scoreSteps
      const scoreIncrement = lead.score / scoreSteps
      
      let currentStep = 0
      const scoreInterval = setInterval(() => {
        currentStep++
        setState(prev => ({ 
          ...prev, 
          currentScore: Math.round(scoreIncrement * currentStep)
        }))
        
        if (currentStep >= scoreSteps) {
          clearInterval(scoreInterval)
          setState(prev => ({ ...prev, currentScore: lead.score }))
        }
      }, stepDuration)
    }, timing.scoringDelay)

    // Scene 5: Connection to CRM
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        showConnection: true,
        completedSteps: [1]
      }))
    }, timing.connectionDelay)

    // Scene 6: CRM updated (sequential steps)
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        showCRM: true,
        completedSteps: [1]
      }))
      
      // Sequential step completion
      setTimeout(() => {
        setState(prev => ({ ...prev, completedSteps: [1, 2] }))
      }, 400)
      setTimeout(() => {
        setState(prev => ({ ...prev, completedSteps: [1, 2, 3] }))
      }, 800)
      setTimeout(() => {
        setState(prev => ({ ...prev, completedSteps: [1, 2, 3, 4] }))
      }, 1200)
    }, timing.crmUpdateDelay)

    // Final: Final message
    setTimeout(() => {
      setState(prev => ({ ...prev, showFinal: true }))
    }, timing.finalDelay)

  }, [config])

  return {
    state,
    runSequence
  }
}
