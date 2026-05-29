import {
  ActionEnum,
  FieldKindEnum,
  FormField,
  OTHER_FIELD_KINDS,
  QUESTION_FIELD_KINDS
} from '@heyform-inc/shared-types-enums'
import * as Tooltip from '@radix-ui/react-tooltip'
import clsx from 'clsx'
import type { FC } from 'react'
import { useEffect, useMemo, useReducer, useState } from 'react'

import { flattenFieldsWithGroups, parseFields, progressPercentage } from './utils'
import { applyLogicToFields } from '@heyform-inc/answer-utils'
import { helper, nanoid } from '@heyform-inc/utils'

import { ClosedMessage } from './blocks/ClosedMessage'
import { SuspendedMessage } from './blocks/SuspendedMessage'
import type { IState, IStripe } from './store'
import { StoreContext, StoreReducer, getStorage } from './store'
import { getTheme } from './theme'
import type { IFormModel } from './typings'
import { Blocks } from './views/Blocks'
import { Sidebar } from './views/Sidebar'

export interface FormRendererProps {
  className?: string
  form: IFormModel
  locale: string
  query?: Record<string, any>
  stripeApiKey?: string
  stripeAccountId?: string
  autoSave?: boolean
  customUrlRedirects?: boolean
  reportAbuseURL?: string
  alwaysShowNextButton?: boolean
  enableQuestionList?: boolean
  enableNavigationArrows?: boolean
  ssr?: boolean
  onSubmit?: (values: Record<string, any>, isPartial?: boolean, stripe?: IStripe) => Promise<void>
}

// Skip a question when a matching hidden field arrives pre-filled (URL query
// or DOM input). Keyed by hidden-field name → matchers (field IDs OR
// case-insensitive title substrings — title fallback survives form rebuilds
// that reissue field IDs).
type FieldMatcher = { id?: string; titleIncludes?: string }
const SKIP_FIELDS_WHEN_HIDDEN_SET: Record<string, FieldMatcher[]> = {
  market_of_interest: [
    { id: 'IyHtFyh8QvL8' },
    { titleIncludes: 'investment markets are you eyeing' }
  ]
}

function fieldTitleText(title: any): string {
  if (typeof title === 'string') return title
  if (Array.isArray(title)) {
    return title
      .map(part => (Array.isArray(part) ? fieldTitleText(part[1]) : String(part ?? '')))
      .join(' ')
  }
  return ''
}

function fieldMatches(field: FormField, matcher: FieldMatcher): boolean {
  if (matcher.id && field.id === matcher.id) return true
  if (matcher.titleIncludes) {
    const text = fieldTitleText(field.title).toLowerCase()
    if (text.includes(matcher.titleIncludes.toLowerCase())) return true
  }
  return false
}

// Sentinel value our upstream sends when the user didn't specify a market —
// treat it as absent so the question still renders.
const HIDDEN_FIELD_UNSET_SENTINELS = new Set(['not specified'])

function readHiddenValue(name: string, query: Record<string, any>): string | undefined {
  let value: string | undefined

  const fromQuery = query?.[name]
  if (helper.isValid(fromQuery) && String(fromQuery).length > 0) {
    value = String(fromQuery)
  } else if (typeof document !== 'undefined') {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    if (input?.value) {
      value = input.value
    }
  }

  if (!value) return
  if (HIDDEN_FIELD_UNSET_SENTINELS.has(value.trim().toLowerCase())) return
  return value
}

function initStore(
  form: IFormModel,
  locale: string,
  autoSave: boolean,
  allowPayment: boolean,
  query: Record<string, any>,
  ssr?: boolean
): IState {
  const list = parseFields(form.fields, form.translations?.[locale])

  const welcomeField = list.find(f => f.kind === FieldKindEnum.WELCOME)
  const thankYouFields = list.filter(f => f.kind === FieldKindEnum.THANK_YOU)

  let allFields = flattenFieldsWithGroups(list.filter(f => !OTHER_FIELD_KINDS.includes(f.kind)))

  if (!allowPayment) {
    allFields = allFields.filter(f => f.kind !== FieldKindEnum.PAYMENT)
  }

  // For each hidden field that's set, drop the matching question(s) AND
  // pre-seed an answer so any downstream validation/logic sees them as filled.
  const skipIds = new Set<string>()
  const seededValues: Record<string, any> = {}
  for (const [hiddenName, matchers] of Object.entries(SKIP_FIELDS_WHEN_HIDDEN_SET)) {
    const hiddenValue = readHiddenValue(hiddenName, query)
    if (!helper.isValid(hiddenValue)) continue
    allFields.forEach(f => {
      if (matchers.some(m => fieldMatches(f, m))) {
        skipIds.add(f.id)
        seededValues[f.id] = hiddenValue
      }
    })
  }
  if (skipIds.size > 0) {
    allFields = allFields
      .filter(f => !skipIds.has(f.id))
      .map(f => (f.parent && skipIds.has(f.parent.id) ? { ...f, parent: undefined } : f))
  }

  const jumpFieldIds = (form.logics || [])
    .filter(l => l.payloads.some(p => p.action.kind === ActionEnum.NAVIGATE))
    .map(l => l.fieldId)

  const values = { ...getStorage(form.id, autoSave), ...seededValues }
  const { fields, variables } = applyLogicToFields(
    [...allFields, ...thankYouFields].filter(Boolean) as FormField[],
    form.logics,
    form.variables,
    values
  )

  const questionCount = fields.filter(f => QUESTION_FIELD_KINDS.includes(f.kind)).length
  const percentage = progressPercentage(Object.keys(values).length, questionCount)

  return {
    // Preventing hydration mismatch errors
    instanceId: ssr ? '' : nanoid(8),
    welcomeField,
    thankYouFields,
    allFields,
    fields,
    hiddenFields: form.hiddenFields || [],
    translations: form.translations,
    query: {},
    jumpFieldIds,
    logics: form.logics,
    parameters: form.variables,
    variables,
    values,
    percentage,
    questionCount,
    formId: form.id,
    scrollIndex: 0,
    scrollTo: 'next',
    settings: form.settings,
    autoSave,
    locale,
    theme: getTheme(form.themeSettings?.theme),
    logo: form.themeSettings?.logo
  }
}

export const FormRenderer: FC<FormRendererProps> = ({
  className,
  form,
  locale,
  query = {},
  autoSave = true,
  stripeApiKey,
  stripeAccountId,
  reportAbuseURL,
  alwaysShowNextButton = false,
  customUrlRedirects = false,
  enableQuestionList,
  enableNavigationArrows,
  ssr = false,
  onSubmit
}) => {
  const [isAndroid, setAndroid] = useState(false)

  useEffect(() => {
    setAndroid(window.heyform.device.android)
  }, [])

  const allowPayment = useMemo(
    () => !!(stripeApiKey && stripeAccountId),
    [stripeApiKey, stripeAccountId]
  )
  const isQuestionListEnabled = useMemo(
    () =>
      !helper.isNil(enableQuestionList)
        ? !!enableQuestionList
        : !!form.settings?.enableQuestionList,
    [enableQuestionList, form.settings?.enableQuestionList]
  )
  const isNavigationArrowsEnabled = useMemo(
    () =>
      !helper.isNil(enableNavigationArrows)
        ? !!enableNavigationArrows
        : helper.isNil(form.settings?.enableNavigationArrows)
          ? true
          : !!form.settings?.enableNavigationArrows,
    [enableNavigationArrows, form.settings?.enableNavigationArrows]
  )
  const memoState: IState = useMemo(
    () => ({
      reportAbuseURL,
      customUrlRedirects,
      alwaysShowNextButton,
      enableQuestionList: isQuestionListEnabled,
      enableNavigationArrows: isNavigationArrowsEnabled,
      onSubmit,
      ...initStore(form, locale, autoSave, allowPayment, query, ssr),
      query
    }),
    [
      reportAbuseURL,
      customUrlRedirects,
      alwaysShowNextButton,
      isQuestionListEnabled,
      isNavigationArrowsEnabled,
      onSubmit,
      form,
      locale,
      autoSave,
      allowPayment,
      ssr,
      query
    ]
  )
  const [state, dispatch] = useReducer(StoreReducer, memoState)

  // Form suspended
  if (form.suspended) {
    return <SuspendedMessage />
  }

  // No questions in a form
  else if (!helper.isValidArray(form.fields)) {
    return <ClosedMessage form={form} />
  }

  useEffect(() => {
    if (allowPayment) {
      const paymentField = memoState.fields.find(f => f.kind === FieldKindEnum.PAYMENT)

      if (paymentField) {
        const stripe = (window as any).Stripe(stripeApiKey, {
          stripeAccount: stripeAccountId
        })

        dispatch({
          type: 'setStripe',
          payload: {
            stripe: {
              elements: stripe.elements({ locale: memoState.locale }),
              confirmCardPayment: stripe.confirmCardPayment.bind(stripe),
              apiKey: stripeApiKey,
              accountId: stripeAccountId
            }
          }
        })
      }
    }
  }, [])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <Tooltip.Provider delayDuration={100}>
        <div
          className={clsx(
            'heyform-root',
            {
              'heyform-root-open': state.isSidebarOpen,
              'heyform-root-android': isAndroid
            },
            className
          )}
        >
          <div
            className={clsx('heyform-wrapper', {
              'heyform-is-welcome': !state.isStarted && state.welcomeField
            })}
          >
            <Blocks />
          </div>
          {enableQuestionList && <Sidebar />}
        </div>
      </Tooltip.Provider>
    </StoreContext.Provider>
  )
}
