import type { Options as PopperOptions } from '@popperjs/core/lib/types'
import { IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import clsx from 'clsx'
import type { CSSProperties, FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { stopEvent, useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import type { ChoiceRadioOption } from './ChoiceRadio'
import { Input } from './Input'
import { Popup } from './Popup'

interface ChoiceDropdownProps {
  className?: string
  options: ChoiceRadioOption[]
  allowMultiple?: boolean
  allowOther?: boolean
  value?: { value: string[]; other?: string }
  onChange?: (value: { value: string[]; other?: string } | undefined) => void
  onDropdownVisibleChange?: (visible: boolean) => void
}

export const ChoiceDropdown: FC<ChoiceDropdownProps> = ({
  className,
  options,
  allowMultiple = false,
  allowOther = false,
  value: rawValue,
  onChange,
  onDropdownVisibleChange
}) => {
  const { t } = useTranslation()
  const [ref, setRef] = useState<HTMLDivElement | null>(null)
  const popperOptions: Partial<PopperOptions> = useMemo(
    () => ({
      placement: 'bottom-start',
      strategy: 'fixed',
      modifiers: [
        { name: 'computeStyles', options: { gpuAcceleration: false } },
        { name: 'offset', options: { offset: [0, 8] } }
      ]
    }),
    []
  )

  const [isOpen, setIsOpen] = useState(false)
  const [triggerStyle, setTriggerStyle] = useState<CSSProperties>()
  const [isOtherSelected, setIsOtherSelected] = useState(false)

  const values = useMemo(() => rawValue?.value || [], [rawValue])
  const otherValue = useMemo(() => rawValue?.other, [rawValue])

  const selectedLabels = useMemo(() => {
    const labels = options
      .filter(o => values.includes(o.value as string))
      .map(o => o.label)
    if (helper.isValid(otherValue)) labels.push(otherValue!)
    return labels
  }, [options, values, otherValue])

  function handleOpen(event: any) {
    stopEvent(event)
    setIsOpen(true)
  }

  function handleClose() {
    setIsOpen(false)
    setTriggerStyle(undefined)
  }

  const handleCloseCallback = useCallback(handleClose, [])

  function handleSelect(optionValue: string) {
    if (!allowMultiple) {
      setIsOtherSelected(false)
      onChange?.({ value: [optionValue], other: undefined })
      handleClose()
    } else {
      const newValues = values.includes(optionValue)
        ? values.filter(v => v !== optionValue)
        : [...values, optionValue]
      onChange?.({ value: newValues, other: otherValue })
    }
  }

  function handleOtherClick() {
    if (!allowMultiple) {
      setIsOtherSelected(true)
      onChange?.({ value: [], other: otherValue || '' })
    } else {
      const nowSelected = !isOtherSelected
      setIsOtherSelected(nowSelected)
      if (!nowSelected) {
        onChange?.({ value: values, other: undefined })
      }
    }
  }

  function handleOtherChange(newOtherValue: string) {
    onChange?.({
      value: values,
      other: helper.isEmpty(newOtherValue) ? undefined : newOtherValue
    })
  }

  useEffect(() => {
    if (allowOther) {
      setIsOtherSelected(helper.isValid(otherValue))
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTriggerStyle(ref?.getBoundingClientRect())
    }
    onDropdownVisibleChange?.(isOpen)
  }, [isOpen])

  const memoOverlay = useMemo(
    () => (
      <div
        className="heyform-select-popup heyform-choice-dropdown-popup"
        style={{ width: triggerStyle?.width }}
      >
        {options.map(option => (
          <div
            key={option.value as string}
            className={clsx('heyform-radio', {
              'heyform-radio-selected': values.includes(option.value as string)
            })}
            onClick={() => handleSelect(option.value as string)}
          >
            <div className="heyform-radio-container">
              <div className="heyform-radio-content">
                <div className="heyform-radio-label">{option.label}</div>
              </div>
              <div className="heyform-radio-icon">
                <IconCheck />
              </div>
            </div>
          </div>
        ))}

        {allowOther && (
          <div
            className={clsx('heyform-radio', { 'heyform-radio-selected': isOtherSelected })}
            onClick={handleOtherClick}
          >
            <div className="heyform-radio-container">
              <div className="heyform-radio-content">
                <div className="heyform-radio-label">
                  {isOtherSelected ? (
                    <Input
                      value={otherValue}
                      placeholder={t('Type your answer')}
                      onClick={stopEvent}
                      onChange={handleOtherChange}
                    />
                  ) : (
                    <div className="heyform-radio-label-text">{t('Other')}</div>
                  )}
                </div>
              </div>
              <div className="heyform-radio-icon">
                <IconCheck />
              </div>
            </div>
          </div>
        )}
      </div>
    ),
    [options, values, otherValue, isOtherSelected, triggerStyle?.width, allowOther]
  )

  return (
    <>
      <div
        ref={setRef}
        className={clsx(
          'heyform-select heyform-choice-dropdown',
          { 'heyform-select-open': isOpen },
          className
        )}
        onClick={handleOpen}
      >
        <div className="heyform-select-container">
          <div className="heyform-select-value">
            <span
              className="heyform-select-label"
              data-placeholder={t('Select an option')}
            >
              {selectedLabels.join(', ')}
            </span>
          </div>
          <div className="heyform-select-arrow-icon">
            {isOpen ? <IconChevronUp /> : <IconChevronDown />}
          </div>
        </div>
        <div className="heyform-group-highlight" />
      </div>

      <Popup
        visible={isOpen}
        referenceRef={ref as Element}
        popperOptions={popperOptions}
        onExited={handleCloseCallback}
      >
        {memoOverlay}
      </Popup>
    </>
  )
}
