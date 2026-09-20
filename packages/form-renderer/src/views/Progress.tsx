import type { FC } from 'react'

import { useStore } from '../store'

export const Progress: FC = () => {
  const { state } = useStore()

  return (
    <div className="heyform-progress-bar">
      <div className="heyform-progress-track">
        <div
          className="heyform-progress-indicator"
          style={{ transform: `translateX(-${100 - (state.percentage || 0)}%)` }}
        />
      </div>
    </div>
  )
}
