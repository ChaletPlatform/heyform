import type {
  FormField,
  FormSettings,
  FormTheme,
  HiddenField,
  Logic,
  Variable
} from '@heyform-inc/shared-types-enums'
import { FieldKindEnum, QUESTION_FIELD_KINDS } from '@heyform-inc/shared-types-enums'
import { useContext } from 'react'
import store2 from 'store2'

import {
  LRU,
  createStoreContext,
  createStoreReducer,
  isFile,
  progressPercentage,
  replaceHTML,
  validateLogicField
} from './utils'
import { applyLogicToFields } from '@heyform-inc/answer-utils'
import { helper } from '@heyform-inc/utils'
import { isHighBudget, AIRBNB_REALTOR_FORM_ID, FITS_YOU_BEST_FIELD_ID, IM_BUYING_CHOICE_ID } from './Renderer'

import type { AnyMap, IFormField } from './typings'

let LRU_CACHE: LRU

export function getLRU(): LRU {
  if (!LRU_CACHE) {
    LRU_CACHE = new LRU({
      bucket: 'HEYFORM_DATA',
      store: {
        getItem: store2.get.bind(store2),
        setItem: store2.set.bind(store2),
        removeItem: store2.remove.bind(store2)
      }
    })
  }
  return LRU_CACHE
}

export function getStorage(formId: string, autoSave?: boolean) {
  const values: any = {}

  if (autoSave) {
    const cache = getLRU().get(formId)

    if (helper.isValid(cache)) {
      Object.keys(values).forEach(key => {
        const value = values[key]

        if (helper.isValid(value)) {
          values[key] = value
        }
      })
    }
  }

  return values
}

export function removeStorage(formId: string) {
  getLRU().remove(formId)
}

export type ScrollDestination = 'next' | 'previous' | string

export interface IStripe {
  elements: stripe.elements.Elements
  confirmCardPayment: (
    clientSecret: string,
    data?: stripe.ConfirmCardPaymentData,
    options?: stripe.ConfirmCardPaymentOptions
  ) => Promise<stripe.PaymentIntentResponse>
  apiKey: string
  accountId: string
}

export interface IState {
  formId: string
  instanceId: string
  welcomeField?: IFormField
  thankYouFieldId?: string
  thankYouFields: IFormField[]
  allFields: IFormField[]
  fields: IFormField[]
  hiddenFields: HiddenField[]
  translations?: Record<string, any>
  query: Record<string, any>
  jumpFieldIds: string[]
  logics?: Logic[]
  parameters?: Variable[]
  variables: AnyMap
  values: AnyMap
  autoSave?: boolean
  settings?: FormSettings
  percentage: number
  questionCount: number
  scrollIndex?: number
  scrollTo?: ScrollDestination
  isScrollNextDisabled?: boolean
  errorFieldId?: string
  isSubmitTouched?: boolean
  isStarted?: boolean
  isSubmitted?: boolean
  isSidebarOpen?: boolean
  reportAbuseURL?: string
  locale: string
  customUrlRedirects?: boolean
  alwaysShowNextButton?: boolean
  enableQuestionList?: boolean
  enableNavigationArrows?: boolean
  logo?: string
  theme: FormTheme
  stripe?: IStripe
  onSubmit?: (values: Record<string, any>, isPartial?: boolean, stripe?: IStripe) => Promise<void>
}

const actions: any = {
  setValues: (state: IState, { values }: any) => {
    const newValues = {
      ...state.values,
      ...values
    }

    // Budget ≥ $600k → skip "Pick what fits you best", auto-fill "I'm Buying"
    const highBudget = state.formId === AIRBNB_REALTOR_FORM_ID && isHighBudget(newValues)
    let effectiveAllFields = state.allFields
    if (highBudget) {
      newValues[FITS_YOU_BEST_FIELD_ID] = { value: [IM_BUYING_CHOICE_ID] }
      effectiveAllFields = state.allFields.filter(f => f.id !== FITS_YOU_BEST_FIELD_ID)
    }

    if (state.autoSave) {
      const cache: AnyMap = {}

      Object.keys(newValues).forEach(key => {
        const value = newValues[key]

        if (helper.isValid(value) && !isFile(value)) {
          cache[key] = value
        }
      })

      getLRU().put(state.formId, cache)
    }

    const { fields, variables } = applyLogicToFields(
      [...effectiveAllFields, ...state.thankYouFields].filter(Boolean) as FormField[],
      state.logics,
      state.parameters,
      newValues
    )

    const questionCount = fields.filter(f => QUESTION_FIELD_KINDS.includes(f.kind)).length
    const percentage = progressPercentage(Object.keys(newValues).length, questionCount)

    const isTouched = validateLogicField(fields[state.scrollIndex!], state.jumpFieldIds, values)
    const isScrollNextDisabled = !isTouched || state.scrollIndex! >= fields.length - 1

    return {
      ...state,
      fields,
      values: newValues,
      variables,
      percentage,
      questionCount,
      isScrollNextDisabled
    }
  },

  setIsStarted: (state: IState, { isStarted }: any) => {
    return actions.scrollTo(
      {
        ...state,
        isStarted,
        isSubmitted: state.fields.length < 1
      },
      {
        scrollIndex: 0,
        scrollTo: 'next'
      }
    )
  },

  setIsSubmitTouched: (state: IState, { isSubmitTouched }: any) => ({ ...state, isSubmitTouched }),

  setIsSubmitted: (state: IState, { isSubmitted, thankYouFieldId }: any) => ({
    ...state,
    isSubmitted,
    isSidebarOpen: false,
    thankYouFieldId
  }),

  setIsSidebarOpen: (state: IState, { isSidebarOpen }: any) => ({ ...state, isSidebarOpen }),

  setStripe: (state: IState, { stripe }: any) => ({ ...state, stripe }),

  resetErrorField: (state: IState) => ({ ...state, errorFieldId: undefined }),

  scrollPrevious: (state: IState) => {
    if (state.scrollIndex! < 1) {
      return state
    }

    let targetIndex = state.scrollIndex! - 1

    // Skip back over group children so Previous lands on the field before the group
    const targetField = state.fields[targetIndex]
    if (targetField?.parent) {
      const parentIndex = state.fields.findIndex(f => f.id === targetField.parent?.id)
      targetIndex = parentIndex > 0 ? parentIndex - 1 : 0
    }

    return actions.scrollTo(state, {
      scrollIndex: targetIndex,
      scrollTo: 'previous'
    })
  },

  scrollNext: (state: IState) => {
    const { scrollIndex, fields, values, jumpFieldIds } = state
    const currentField = fields[scrollIndex!]

    // If on a GROUP or a group child, skip past all children to the next real field
    const groupId =
      currentField?.kind === FieldKindEnum.GROUP
        ? currentField.id
        : currentField?.parent?.id

    if (groupId) {
      let nextIndex = scrollIndex! + 1
      while (
        nextIndex < fields.length &&
        (fields[nextIndex]?.parent?.id === groupId || fields[nextIndex]?.id === groupId)
      ) {
        nextIndex++
      }
      if (nextIndex >= fields.length) {
        return { ...state, isScrollNextDisabled: true }
      }
      return actions.scrollTo(state, { scrollIndex: nextIndex, scrollTo: 'next' })
    }

    const isTouched = validateLogicField(fields[scrollIndex!], jumpFieldIds, values)

    if (!isTouched || scrollIndex! >= fields.length - 1) {
      return {
        ...state,
        isScrollNextDisabled: true
      }
    }

    return actions.scrollTo(state, {
      scrollIndex: scrollIndex! + 1,
      scrollTo: 'next'
    })
  },

  scrollToField(state: IState, { fieldId, errorFieldId }: any) {
    let index = state.fields.findIndex(f => f.id === fieldId)

    if (index < 0) {
      return state
    }

    // If targeting a group child, redirect to the parent group
    const field = state.fields[index]
    if (field?.parent) {
      const parentIndex = state.fields.findIndex(f => f.id === field.parent?.id)
      if (parentIndex >= 0) index = parentIndex
    }

    return actions.scrollTo(state, {
      scrollIndex: index,
      scrollTo:
        !helper.isNil(state.scrollIndex) && index >= state.scrollIndex! ? 'next' : 'previous',
      errorFieldId
    })
  },

  scrollTo(state: IState, { scrollIndex, scrollTo, errorFieldId }: any) {
    const { fields, values, variables } = state
    const field = fields[scrollIndex]

    field.title = replaceHTML(field.title as string, values, fields, state.query, variables)
    field.description = replaceHTML(
      field.description as string,
      values,
      fields,
      state.query,
      variables
    )

    return {
      ...state,
      fields,
      scrollIndex,
      scrollTo,
      isScrollNextDisabled: false,
      errorFieldId
    }
  }
}

export const StoreContext = createStoreContext<IState>({
  instanceId: '',
  formId: '',
  allFields: [],
  fields: [],
  thankYouFields: [],
  hiddenFields: [],
  query: {},
  jumpFieldIds: [],
  values: {},
  variables: {},
  percentage: 0,
  questionCount: 0,
  locale: 'en',
  theme: {}
})

export const StoreReducer = createStoreReducer<IState>(actions, (_, newState) => newState)

export function useStore() {
  return useContext(StoreContext)
}
