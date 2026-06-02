import { FC, useEffect, useState } from 'react'

import { useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { ChoiceDropdown, ChoiceRadioGroup, FormField, SelectHelper } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'
import { useChoicesOption, useSelectionRange } from './hook'

export const MultipleChoice: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()

  const [isOtherFilled, setIsOtherFilled] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const isDropdown = field.properties?.displayAs === 'dropdown'

  const options = useChoicesOption(
    field.properties?.choices,
    field.properties?.randomize,
    state.translations?.[state.locale]?.[field.id]?.choices,
    field.properties?.badge
  )
  const { min, max, allowMultiple } = useSelectionRange(
    field.properties?.allowMultiple,
    field.validations?.min,
    field.validations?.max
  )

  function getValues({ value }: any) {
    return helper.isValidArray(value?.value) || helper.isValid(value?.other) ? value : undefined
  }

  function handleValuesChange(_: any, { value }: any) {
    setIsOtherFilled(helper.isValid(value?.other))
  }

  useEffect(() => {
    const value = state.values[field.id]

    setIsOtherFilled(helper.isValid(value?.other))
  }, [field.id, state.values])

  const validationRules = [
    {
      validator: (_: any, value: any) => {
        if (field.validations?.required) {
          if (helper.isEmpty(value)) {
            return Promise.reject(t('This field is required'))
          }
        } else if (helper.isNil(value)) {
          return Promise.resolve()
        }

        let count = value.value.length

        if (field.properties?.allowOther && helper.isValid(value.other)) {
          count += 1
        }

        if (count < min) {
          return Promise.reject(
            t('Choose at least {{min}} choices', { min: field.validations?.min })
          )
        }

        if (max > 0 && count > max) {
          return Promise.reject(
            t('Choose up to {{max}} choices', { max: field.validations?.max })
          )
        }

        return Promise.resolve()
      }
    }
  ]

  return (
    <Block
      className="heyform-multiple-choice"
      field={field}
      isScrollable={!isDropdownOpen}
      {...restProps}
    >
      {!isDropdown && <SelectHelper min={min} max={max} />}

      <Form
        initialValues={{
          value: state.values[field.id]
        }}
        autoSubmit={!allowMultiple}
        isSubmitShow={allowMultiple}
        field={field}
        getValues={getValues}
        onValuesChange={handleValuesChange}
      >
        <FormField name="value" rules={validationRules}>
          {isDropdown ? (
            <ChoiceDropdown
              options={options}
              allowMultiple={field.properties?.allowMultiple}
              allowOther={field.properties?.allowOther}
              onDropdownVisibleChange={setIsDropdownOpen}
            />
          ) : (
            <ChoiceRadioGroup
              options={options}
              allowMultiple={field.properties?.allowMultiple}
              allowOther={field.properties?.allowOther}
              badge={field.properties?.badge}
              verticalAlignment={field.properties?.verticalAlignment}
              isOtherFilled={isOtherFilled}
              max={field.validations?.max ?? 0}
            />
          )}
        </FormField>
      </Form>
    </Block>
  )
}
