import { FC } from 'react'
import { Trans } from 'react-i18next'

import { useTranslation } from '../utils'

import { LogoIcon } from '../components'
import { useStore } from '../store'

export const Branding: FC = () => {
  const { state } = useStore()
  const { t } = useTranslation()

  return null
}

export const WelcomeBranding: FC = () => {
  return (
    <div className="heyform-footer heyform-welcome-footer">
      <div className="heyform-footer-wrapper">
        <div className="heyform-footer-left" />
        <div className="heyform-footer-right">
          <Branding />
        </div>
      </div>
    </div>
  )
}
