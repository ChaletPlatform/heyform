import { useEffect, useRef } from 'react'

import { htmlUtils } from '@heyform-inc/answer-utils'

import { useStore } from '../store'
import type { IFormField } from '../typings'

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, any>) => void
    }
  }
}

function getPostHog() {
  return typeof window !== 'undefined' ? window.posthog : undefined
}

function titleToPlainText(title: any): string {
  if (typeof title === 'string') return title
  if (Array.isArray(title)) {
    return htmlUtils.plain(htmlUtils.serialize(title))
  }
  return ''
}

function questionProps(field: IFormField | undefined, index: number) {
  if (!field) return {}
  return {
    question_id: field.id,
    question_index: index,
    question_title: titleToPlainText(field.title),
    question_type: field.kind
  }
}

export function usePostHogTracking() {
  const { state } = useStore()

  const startedAtRef = useRef<number>()
  const prevScrollIndexRef = useRef<number | undefined>(undefined)
  const answeredKeysRef = useRef<Set<string>>(new Set())
  const submittedRef = useRef(false)

  const commonProps = () => ({
    form_id: state.formId,
    session_id: state.instanceId,
    question_count: state.questionCount
  })

  // heyform_loaded — once on mount
  useEffect(() => {
    getPostHog()?.capture('heyform_loaded', commonProps())
  }, [])

  // heyform_started — user engaged with the form:
  // - Welcome screen: clicks Start (isStarted flips true)
  // - No welcome screen: answers the first question (first key appears in values)
  useEffect(() => {
    if (startedAtRef.current) return

    const hasWelcome = !!state.welcomeField
    const shouldFire = hasWelcome
      ? state.isStarted
      : Object.keys(state.values).length > 0

    if (shouldFire) {
      startedAtRef.current = Date.now()
      getPostHog()?.capture('heyform_started', commonProps())
    }
  }, [state.isStarted, state.values])

  // heyform_question_viewed — when scrollIndex changes
  useEffect(() => {
    if (state.scrollIndex == null) return
    if (state.scrollIndex === prevScrollIndexRef.current) return

    prevScrollIndexRef.current = state.scrollIndex
    const field = state.fields[state.scrollIndex]

    getPostHog()?.capture('heyform_question_viewed', {
      ...commonProps(),
      ...questionProps(field, state.scrollIndex)
    })
  }, [state.scrollIndex])

  // heyform_question_answered — when a new key appears in state.values
  useEffect(() => {
    const currentKeys = Object.keys(state.values)

    for (const key of currentKeys) {
      if (!answeredKeysRef.current.has(key)) {
        answeredKeysRef.current.add(key)
        const fieldIndex = state.fields.findIndex((f: IFormField) => f.id === key)

        if (fieldIndex >= 0) {
          getPostHog()?.capture('heyform_question_answered', {
            ...commonProps(),
            ...questionProps(state.fields[fieldIndex], fieldIndex)
          })
        }
      }
    }
  }, [state.values])

  // heyform_submitted
  useEffect(() => {
    if (state.isSubmitted) {
      submittedRef.current = true
      const duration = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : undefined

      getPostHog()?.capture('heyform_submitted', {
        ...commonProps(),
        completion_time_seconds: duration,
        answers_count: Object.keys(state.values).length
      })
    }
  }, [state.isSubmitted])

  // heyform_abandoned — beforeunload + visibilitychange
  // Only fire if user actually started (answered at least one question or clicked Start)
  useEffect(() => {
    const handleAbandon = () => {
      if (submittedRef.current) return
      if (!startedAtRef.current) return

      getPostHog()?.capture('heyform_abandoned', {
        ...commonProps(),
        last_question_index: state.scrollIndex,
        last_question_id: state.fields[state.scrollIndex!]?.id,
        answers_count: Object.keys(state.values).length,
        completion_pct: state.percentage
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAbandon()
      }
    }

    window.addEventListener('beforeunload', handleAbandon)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleAbandon)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [state.isStarted, state.scrollIndex, state.values, state.percentage])
}
