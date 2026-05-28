import { ChangeEvent, FC, useState } from 'react'

import { cn } from '@/utils'

interface SliderProps extends Omit<ComponentProps, 'onChange'> {
  value?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange?: (value: number) => void
}

export const Slider: FC<SliderProps> = ({
  className,
  value: rawValue = 0,
  min = 1,
  max = 10,
  step = 1,
  disabled,
  onChange,
  ...restProps
}) => {
  const [value, setValue] = useState(rawValue)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const newValue = Number(event.target.value)

    setValue(newValue)
    onChange?.(newValue)
  }

  return (
    <div className={cn('relative h-3 w-full py-2.5', className)} {...restProps}>
      <div className="bg-accent-light h-0.5 rounded-sm">
        <div
          className="bg-primary after:bg-primary relative mt-0 h-full after:absolute after:-right-1.5 after:top-1/2 after:-mt-1.5 after:h-3 after:w-3 after:rounded-full"
          style={{
            width: `${(100 * (value - min)) / (max - min)}%`
          }}
        />
      </div>
      <input
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}
