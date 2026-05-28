import type { FC } from 'react'

import { initialValue, useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { FormField, Input } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const FullName: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()

  function getValues(values: any) {
    const raw = (values?.fullName ?? '').trim()
    if (!helper.isValid(raw)) return undefined
    const idx = raw.indexOf(' ')
    const firstName = idx === -1 ? raw : raw.slice(0, idx)
    const lastName = idx === -1 ? '' : raw.slice(idx + 1).trim()
    return { firstName, lastName }
  }

  const stored = state.values[field.id] as { firstName?: string; lastName?: string } | undefined
  const initialFullName = [stored?.firstName, stored?.lastName].filter(Boolean).join(' ')

  return (
    <Block className="heyform-full-name" field={field} {...restProps}>
      <Form
        initialValues={initialValue({ fullName: initialFullName })}
        field={field}
        getValues={getValues}
      >
        <FormField
          name="fullName"
          rules={[
            {
              required: field.validations?.required,
              message: t('This field is required')
            }
          ]}
        >
          <Input placeholder={t('Full Name')} />
        </FormField>
      </Form>
    </Block>
  )
}
