import { FieldKindEnum } from '@heyform-inc/shared-types-enums'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { FC, useState } from 'react'
import RCForm, { useForm } from 'rc-field-form'

import {
  getNavigateFieldId,
  removeHeading,
  sendMessageToParent,
  useTranslation
} from '../utils'
import { applyLogicToFields, validateFields } from '@heyform-inc/answer-utils'
import { clone, helper } from '@heyform-inc/utils'

import { FormField, Input, PhoneNumberInput, Textarea, Submit } from '../components'
import { removeStorage, useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'

const GroupChildField: FC<{ field: any; t: (s: string) => string }> = ({ field, t }) => {
  const label = (
    <div className="heyform-group-child-label">
      {field.title && (
        <span
          className="heyform-group-child-title"
          dangerouslySetInnerHTML={{ __html: removeHeading(field.title as string) }}
        />
      )}
      {field.validations?.required && (
        <span className="heyform-group-child-required" aria-hidden="true">
          *
        </span>
      )}
    </div>
  )

  switch (field.kind) {
    case FieldKindEnum.EMAIL:
      return (
        <div className="heyform-group-child">
          {label}
          <FormField
            name={field.id}
            rules={[
              {
                required: field.validations?.required,
                type: 'email',
                message: t('Please enter a valid email address')
              }
            ]}
          >
            <Input type="email" placeholder="email@example.com" />
          </FormField>
        </div>
      )

    case FieldKindEnum.FULL_NAME:
      return (
        <div className="heyform-group-child">
          {label}
          <div className="flex w-full items-start justify-items-stretch space-x-4">
            <FormField
              className="flex-1"
              name={[field.id, 'firstName']}
              rules={[
                {
                  required: field.validations?.required,
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('First Name')} />
            </FormField>
            <FormField
              className="flex-1"
              name={[field.id, 'lastName']}
              rules={[
                {
                  required: field.validations?.required,
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('Last Name')} />
            </FormField>
          </div>
        </div>
      )

    case FieldKindEnum.PHONE_NUMBER:
      return (
        <div className="heyform-group-child heyform-phone-number">
          {label}
          <FormField
            name={field.id}
            rules={[
              {
                required: field.validations?.required,
                validator(rule: any, value: string) {
                  return new Promise<void>((resolve, reject) => {
                    if (!rule.required && helper.isEmpty(value)) return resolve()
                    if (isValidPhoneNumber(value || '')) resolve()
                    else reject(rule.message)
                  })
                },
                message: t('Please enter a valid phone number')
              }
            ]}
          >
            <PhoneNumberInput defaultCountryCode={field.properties?.defaultCountryCode} />
          </FormField>
        </div>
      )

    case FieldKindEnum.NUMBER:
      return (
        <div className="heyform-group-child">
          {label}
          <FormField
            name={field.id}
            rules={[
              {
                required: field.validations?.required,
                message: t('This field is required')
              }
            ]}
          >
            <Input type="number" placeholder={t('Your answer goes here')} />
          </FormField>
        </div>
      )

    case FieldKindEnum.LONG_TEXT:
      return (
        <div className="heyform-group-child">
          {label}
          <FormField
            name={field.id}
            rules={[
              {
                required: field.validations?.required,
                message: t('This field is required')
              }
            ]}
          >
            <Textarea placeholder={t('Your answer goes here')} />
          </FormField>
        </div>
      )

    case FieldKindEnum.STATEMENT:
      return (
        <div className="heyform-group-child heyform-group-child-statement">
          {label}
        </div>
      )

    default:
      return (
        <div className="heyform-group-child">
          {label}
          <FormField
            name={field.id}
            rules={[
              {
                required: field.validations?.required,
                message: t('This field is required')
              }
            ]}
          >
            <Input placeholder={t('Your answer goes here')} />
          </FormField>
        </div>
      )
  }
}

export const Group: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state, dispatch } = useStore()
  const { t } = useTranslation()
  const [form] = useForm()
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  const children = state.fields.filter(f => f.parent?.id === field.id)

  // Build initial values from stored answers
  const initialValues: Record<string, any> = {}
  children.forEach(child => {
    const stored = state.values[child.id]
    if (helper.isValid(stored)) {
      initialValues[child.id] = stored
    }
  })

  // Compute whether this group is the last effective page
  const effectiveNextIndex = (() => {
    const groupId = field.id
    let next = state.scrollIndex! + 1
    while (
      next < state.fields.length &&
      (state.fields[next]?.parent?.id === groupId || state.fields[next]?.id === groupId)
    ) {
      next++
    }
    return next
  })()
  const isEffectivelyLastBlock = effectiveNextIndex >= state.fields.length

  function handleValuesChange(changes: Record<string, any>) {
    // Sync values to store as user types (enables auto-save, progress bar, logic)
    const childValues: Record<string, any> = {}
    children.forEach(child => {
      const val = changes[child.id]
      if (val !== undefined) {
        childValues[child.id] = val
      }
    })

    if (Object.keys(childValues).length > 0) {
      dispatch({ type: 'setValues', payload: { values: childValues } })
    }

    // Clear field errors on change (matches Form.tsx behavior)
    const allValues = form.getFieldsValue()
    Object.keys(allValues).forEach(name => {
      const error = form.getFieldError(name)
      if (error.length > 0) {
        form.setFields([{ name, errors: [] }])
      }
    })
  }

  async function handleFinish(formValues: Record<string, any>) {
    const childValues: Record<string, any> = {}
    children.forEach(child => {
      const val = formValues[child.id]
      if (helper.isValid(val)) {
        childValues[child.id] = val
      }
    })

    const allValues = { ...state.values, ...childValues }

    if (Object.keys(childValues).length > 0) {
      dispatch({ type: 'setValues', payload: { values: childValues } })
    }

    if (isEffectivelyLastBlock) {
      if (loading) return

      dispatch({ type: 'setIsSubmitTouched', payload: { isSubmitTouched: true } })
      setSubmitError(undefined)

      try {
        validateFields(state.fields, allValues)
        setLoading(true)
        await state.onSubmit?.(allValues, false, state.stripe)

        if (helper.isTrue(state.query.hideAfterSubmit)) {
          sendMessageToParent('HIDE_EMBED_MODAL')
        }

        setLoading(false)
        removeStorage(state.formId)

        const { variables } = applyLogicToFields(
          clone([...state.allFields, ...state.thankYouFields].filter(Boolean)),
          state.logics,
          state.parameters,
          allValues
        )
        const thankYouFieldId = getNavigateFieldId(
          field,
          state.thankYouFields,
          state.logics,
          state.parameters,
          allValues,
          variables
        )
        dispatch({
          type: 'setIsSubmitted',
          payload: {
            isSubmitted: true,
            thankYouFieldId: thankYouFieldId || state.thankYouFields[0]?.id
          }
        })
      } catch (err: any) {
        setLoading(false)

        if (helper.isValid(err?.response?.id)) {
          dispatch({
            type: 'scrollToField',
            payload: {
              fieldId: err.response.id,
              errorFieldId: err.response.id
            }
          })
        } else {
          setSubmitError(err?.message)
        }
      }
      return
    }

    // Not the last block — check if submit was already touched (re-validate all)
    if (state.isSubmitTouched) {
      try {
        validateFields(state.fields, allValues)
      } catch (err: any) {
        if (helper.isValid(err?.response?.id)) {
          dispatch({
            type: 'scrollToField',
            payload: {
              fieldId: err.response.id,
              errorFieldId: err.response.id
            }
          })
        }
        return
      }
    }

    dispatch({ type: 'scrollNext' })
  }

  if (children.length === 0) {
    return (
      <Block className="heyform-group heyform-statement heyform-empty-state" field={field} {...restProps}>
        <RCForm form={form} onFinish={handleFinish}>
          <Submit text={t('Next')} />
        </RCForm>
      </Block>
    )
  }

  return (
    <Block className="heyform-group" field={field} {...restProps}>
      <RCForm
        className="heyform-form heyform-group-form"
        autoComplete="off"
        form={form}
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
        onFinish={handleFinish}
      >
        <div className="heyform-group-children">
          {children.map(child => (
            <GroupChildField key={child.id} field={child} t={t} />
          ))}
        </div>

        <div className="heyform-group-submit">
          {submitError && (
            <div className="heyform-validation-wrapper">
              <div className="heyform-validation-error">{submitError}</div>
            </div>
          )}
          <Submit
            text={isEffectivelyLastBlock ? t('Submit') : (field.properties?.buttonText || t('Next'))}
            loading={loading}
          />
        </div>
      </RCForm>
    </Block>
  )
}
