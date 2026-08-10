import {
  FormRenderer,
  getTheme,
  getThemeStyle,
  getWebFontURL,
  sendMessageToParent
} from '@heyform-inc/form-renderer/src'
import {
  CaptchaKindEnum,
  FieldKindEnum,
  FormModel,
  HiddenFieldAnswer
} from '@heyform-inc/shared-types-enums'
import { FC, useEffect, useRef, useState } from 'react'

import { EndpointService } from '../service/endpoint'
import { recaptchaToken } from '../utils/captcha'
import { isStripeEnabled } from '../utils/payment'
import { Uploader } from '../utils/uploader'
import { helper } from '@heyform-inc/utils'

import { GOOGLE_RECAPTCHA_KEY } from '@/consts/env'

import { PasswordCheck } from './PasswordCheck'
import { OtpVerification } from './OtpVerification'

interface RendererProps {
  form: FormModel
  query: Record<string, Any>
  locale: string
  contactId?: string
}

let captchaRef: Any = null

// Chalet: a form opts into phone verification by declaring a hidden field with
// this name. The OTP result is written back into it so it flows to the webhook.
const OTP_HIDDEN_FIELD_NAME = 'phone_verified'

// Find the first PHONE_NUMBER field, including group children (lead-capture
// group). `values` keys group children by their own id, so this id resolves the
// entered phone number.
function findPhoneField(fields?: Any[]): Any {
  for (const f of fields || []) {
    if (f.kind === FieldKindEnum.PHONE_NUMBER) return f
    if (f.kind === FieldKindEnum.GROUP) {
      const child = (f.properties?.fields || []).find(
        (c: Any) => c.kind === FieldKindEnum.PHONE_NUMBER
      )
      if (child) return child
    }
  }
  return undefined
}

export const Renderer: FC<RendererProps> = ({ form, query, locale, contactId }) => {
  const openTokenRef = useRef<string>('')
  const passwordTokenRef = useRef<string>('')
  const [isPasswordChecked, setIsPasswordChecked] = useState(false)
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [otpSubmissionId, setOtpSubmissionId] = useState<string | null>(null)

  function finishOtp(verified: boolean) {
    if (verified && otpSubmissionId) {
      EndpointService.updateSubmissionHiddenField({
        formId: form.id,
        submissionId: otpSubmissionId,
        fieldName: OTP_HIDDEN_FIELD_NAME,
        value: 'true'
      }).catch(err => console.error('[OTP] Failed to update hidden field:', err))
    }
    setOtpPhone(null)
    setOtpSubmissionId(null)
  }

  function loadExternalScript(id: string, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loadedScript = document.getElementById(id) as HTMLScriptElement | null

      if (loadedScript) {
        if (loadedScript.dataset.loaded === 'true') {
          resolve()
          return
        }

        loadedScript.addEventListener('load', () => resolve(), { once: true })
        loadedScript.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
          once: true
        })
        return
      }

      const script = document.createElement('script')
      script.id = id
      script.src = src
      script.async = true
      script.defer = true
      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true'
          resolve()
        },
        { once: true }
      )
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true
      })
      document.body.appendChild(script)
    })
  }

  async function ensureCaptchaReady() {
    if (form.settings?.captchaKind !== CaptchaKindEnum.GOOGLE_RECAPTCHA) {
      return
    }

    if (
      captchaRef?.ready &&
      (typeof captchaRef?.execute === 'function' ||
        typeof captchaRef?.enterprise?.execute === 'function')
    ) {
      return
    }

    const key =
      window.heyform?.googleRecaptchaKey ||
      (form.settings as Any)?.googleRecaptchaKey ||
      GOOGLE_RECAPTCHA_KEY

    if (!key) {
      throw new Error('Google reCAPTCHA key is not configured')
    }

    window.heyform = window.heyform || {}
    window.heyform.googleRecaptchaKey = key

    await loadExternalScript(
      'google-recaptcha-sdk',
      `https://www.google.com/recaptcha/api.js?render=${key}`
    )
    captchaRef = window.grecaptcha

    // Some keys only work with enterprise.js. Fallback automatically.
    if (
      !captchaRef?.ready ||
      (typeof captchaRef?.execute !== 'function' &&
        typeof captchaRef?.enterprise?.execute !== 'function')
    ) {
      await loadExternalScript(
        'google-recaptcha-enterprise-sdk',
        `https://www.google.com/recaptcha/enterprise.js?render=${key}`
      )
      captchaRef = window.grecaptcha
    }

    if (!captchaRef?.ready) {
      throw new Error('Google reCAPTCHA failed to initialize')
    }
  }

  async function openForm() {
    sendMessageToParent('FORM_OPENED')
    openTokenRef.current = await EndpointService.openForm(form.id)
  }

  function handlePasswordFinish(passwordToken: string) {
    passwordTokenRef.current = passwordToken
    setIsPasswordChecked(true)
  }

  async function handleSubmit(values: Any, partialSubmission?: boolean, stripe?: Any) {
    try {
      let token: Record<string, Any> = {}

      if (form.settings?.captchaKind === CaptchaKindEnum.GOOGLE_RECAPTCHA) {
        await ensureCaptchaReady()
        token.recaptchaToken = await recaptchaToken(captchaRef)
      }

      const file = await new Uploader(form, values).start()

      const hiddenFields = (form!.hiddenFields || [])
        .map(field => {
          let value = query[field.name]

          // Fallback: read from DOM hidden input (e.g. injected by TrustedForm SDK)
          if (!helper.isValid(value)) {
            const input = document.querySelector<HTMLInputElement>(`input[name="${field.name}"]`)
            if (input) {
              value = input.value
            }
          }

          // Log diagnostics when TrustedForm cert URL is missing
          if (field.name === 'xxTrustedFormCertUrl' && !helper.isValid(value)) {
            const tfScript = document.querySelector<HTMLScriptElement>('script[src*="trustedform"]')
            const tfInput = document.querySelector<HTMLInputElement>('input[name="xxTrustedFormCertUrl"]')

            const diagnostics: Record<string, any> = {
              form_id: form.id,
              tf_script_present: !!tfScript,
              tf_input_present: !!tfInput,
              tf_input_value: tfInput?.value || null,
              query_param_value: query[field.name] || null,
              user_agent: navigator.userAgent
            }

            // Check if the SDK script was blocked from loading
            if (tfScript) {
              diagnostics.tf_script_loaded = tfScript.dataset?.loaded === 'true' || !!tfScript.src
            }

            console.warn('[TrustedForm] cert URL missing at submit', diagnostics)

            if (typeof window.posthog?.capture === 'function') {
              window.posthog.capture('trustedform_cert_missing', diagnostics)
            }
          }

          if (helper.isValid(value)) {
            return {
              ...field,
              value
            }
          }
        })
        .filter(Boolean) as HiddenFieldAnswer[]

      // Chalet: when the form declares a `phone_verified` hidden field, submit
      // immediately with 'false' (so the data is safe), then show the OTP
      // overlay. The server delays the webhook for 5 minutes. If the user
      // verifies, finishOtp calls updateSubmissionHiddenField which flips the
      // value to 'true', cancels the delayed job, and fires the webhook
      // immediately. If they close the tab, the delayed job fires with 'false'.
      const otpField = (form.hiddenFields || []).find(f => f.name === OTP_HIDDEN_FIELD_NAME)
      if (otpField) {
        const existingIndex = hiddenFields.findIndex(
          h => h.name === OTP_HIDDEN_FIELD_NAME || h.id === (otpField as Any).id
        )
        if (existingIndex >= 0) hiddenFields.splice(existingIndex, 1)
        hiddenFields.push({ ...otpField, value: 'false' } as HiddenFieldAnswer)
      }

      const { submissionId, clientSecret } = await EndpointService.completeSubmission({
        formId: form.id,
        contactId,
        answers: {
          ...values,
          ...file
        },
        hiddenFields,
        openToken: openTokenRef.current,
        passwordToken: passwordTokenRef.current,
        partialSubmission,
        ...(token || {})
      })

      if (stripe && helper.isValid(clientSecret)) {
        const paymentField = form.fields?.find(f => f.kind === FieldKindEnum.PAYMENT)

        if (paymentField) {
          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card: stripe.elements.getElement('cardNumber'),
              billing_details: values[paymentField.id]?.billingDetails
            }
          })

          if (result.error) {
            throw new Error(result.error.message)
          }
        }
      }

      sendMessageToParent('FORM_SUBMITTED')

      // Show OTP overlay after submission is saved. The form already shows the
      // thank-you page at this point; the overlay sits on top of it.
      if (otpField && submissionId) {
        const phoneField = findPhoneField(form.fields)
        const phone = phoneField ? values[phoneField.id] : undefined
        if (phone && typeof phone === 'string') {
          setOtpSubmissionId(submissionId)
          setOtpPhone(phone)
        }
      }
    } catch (err: Any) {
      /**
       * Throw error to let Renderer knows that there was an error.
       * If we don't do this, the form will be show as submitted
       */
      throw err
    }
  }

  async function initCaptcha() {
    // reCAPTCHA initializes lazily on submit.
  }

  useEffect(() => {
    sendMessageToParent('FORM_LOADED')

    if (!form.suspended && form.settings?.active) {
      openForm()
      initCaptcha().catch(console.error)
    }
  }, [])

  if (form.settings?.requirePassword && !isPasswordChecked) {
    return <PasswordCheck form={form} onFinish={handlePasswordFinish} />
  }

  const theme = getTheme(form.themeSettings?.theme)
  const fontURL = getWebFontURL(theme.fontFamily)

  return (
    <>
      {helper.isValid(fontURL) && <link href={fontURL} rel="stylesheet" />}
      <style dangerouslySetInnerHTML={{ __html: getThemeStyle(theme, query) }} />

      {isStripeEnabled(form) && <script id="stripe" src="https://js.stripe.com/v3/" />}

      <FormRenderer
        form={form as Any}
        query={query}
        locale={locale}
        stripeApiKey={(form as Any).stripe?.publishableKey}
        stripeAccountId={(form as Any).stripe?.accountId}
        autoSave={!(form.settings?.enableTimeLimit && helper.isValid(form.settings?.timeLimit))}
        alwaysShowNextButton={true}
        customUrlRedirects={(form.settings as Any)?.customUrlRedirects}
        enableQuestionList={form.settings?.enableQuestionList}
        enableNavigationArrows={form.settings?.enableNavigationArrows}
        onSubmit={handleSubmit}
      />

      {/* Custom css */}
      {helper.isValid(form.themeSettings?.theme?.customCSS) && (
        <style dangerouslySetInnerHTML={{ __html: form.themeSettings!.theme!.customCSS! }} />
      )}

      {/* Chalet: phone verification overlay (shown after submission) */}
      {otpPhone && (
        <OtpVerification phone={otpPhone} formId={form.id} onDone={finishOtp} />
      )}
    </>
  )
}
