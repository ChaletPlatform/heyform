import { CSSProperties, ChangeEvent, FC, useCallback, useEffect, useRef, useState } from 'react'

const OTP_API_BASE = 'https://cbehz6zbjl.execute-api.us-west-2.amazonaws.com'
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 30
const OTP_TIMEOUT_MS = 5 * 60 * 1000

type OtpStatus = 'sending' | 'input' | 'verifying' | 'success' | 'error'

interface OtpVerificationProps {
  phone: string
  formId: string
  onDone: (verified: boolean) => void
}

function maskPhone(phone: string) {
  if (phone.length < 4) return phone
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4)
}

export const OtpVerification: FC<OtpVerificationProps> = ({ phone, formId, onDone }) => {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<OtpStatus>('sending')
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN)
  const verifyingRef = useRef(false)
  const doneRef = useRef(false)

  const finish = useCallback((verified: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    onDone(verified)
  }, [onDone])

  const sendOtp = useCallback(async () => {
    setStatus('sending')
    setError('')
    setCode('')

    try {
      const res = await fetch(`${OTP_API_BASE}/v1/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, formId })
      })
      const data = await res.json()

      if (data.required === false) {
        finish(false)
        return
      }

      if (res.status === 429) {
        setStatus('error')
        setError(data.error || 'Too many attempts. Please try again later.')
        return
      }

      if (!res.ok || !data.success) {
        setStatus('error')
        setError(data.error || 'Failed to send code.')
        return
      }

      setStatus('input')
      setResendTimer(RESEND_COOLDOWN)
      setAttemptsRemaining(null)
    } catch {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }, [phone, formId, finish])

  const verifyOtp = useCallback(
    async (value: string) => {
      if (verifyingRef.current) return
      verifyingRef.current = true
      setStatus('verifying')
      setError('')
      try {
        const res = await fetch(`${OTP_API_BASE}/v1/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: value })
        })
        const data = await res.json()

        if (data.verified) {
          setStatus('success')
          setTimeout(() => finish(true), 1000)
          return
        }

        setStatus('input')
        setError(data.error || 'Incorrect code.')
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining)
        }
        setCode('')
      } catch {
        setStatus('input')
        setError('Network error. Please try again.')
      } finally {
        verifyingRef.current = false
      }
    },
    [phone, finish]
  )

  // Send the code as soon as the overlay mounts.
  useEffect(() => {
    sendOtp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-dismiss after 5 minutes (matches OTP code expiry and server delay).
  useEffect(() => {
    const t = setTimeout(() => finish(false), OTP_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [finish])

  // Resend countdown.
  useEffect(() => {
    if (status !== 'input' || resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(prev => prev - 1), 1000)
    return () => clearInterval(t)
  }, [status, resendTimer])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setCode(value)
    if (value.length === OTP_LENGTH) {
      verifyOtp(value)
    }
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true">
      <div style={styles.card}>
        <h2 style={styles.title}>Verify your phone number</h2>
        <p style={styles.subtitle}>
          {status === 'sending'
            ? 'Sending verification code…'
            : `We sent a 6-digit code to ${maskPhone(phone)}`}
        </p>

        {status === 'error' && (
          <div style={styles.center}>
            <p style={styles.error}>{error}</p>
            <button type="button" style={styles.secondaryBtn} onClick={sendOtp}>
              Try again
            </button>
          </div>
        )}

        {status === 'success' && <p style={styles.success}>Phone verified ✓</p>}

        {(status === 'input' || status === 'verifying') && (
          <>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={handleChange}
              disabled={status === 'verifying'}
              placeholder="––––––"
              style={styles.otpInput}
            />

            {error && (
              <p style={styles.error}>
                {error}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <span style={styles.muted}>
                    {' '}
                    ({attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} left)
                  </span>
                )}
              </p>
            )}

            {status === 'verifying' && <p style={styles.muted}>Verifying…</p>}

            <button
              type="button"
              style={styles.linkBtn}
              onClick={sendOtp}
              disabled={resendTimer > 0 || status === 'verifying'}
            >
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#fff',
    borderRadius: 12,
    padding: '28px 24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    textAlign: 'center',
    fontFamily: 'inherit',
    color: '#111'
  },
  title: { fontSize: 18, fontWeight: 600, margin: '0 0 6px' },
  subtitle: { fontSize: 14, color: '#555', margin: '0 0 16px' },
  otpInput: {
    width: '100%',
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    padding: '12px 8px',
    border: '1px solid #ccc',
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box'
  },
  error: { color: '#d33', fontSize: 13, margin: '10px 0 0' },
  success: { color: '#0a7', fontSize: 15, fontWeight: 600, margin: '12px 0' },
  muted: { color: '#888', fontSize: 13, margin: '8px 0 0' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  secondaryBtn: {
    marginTop: 10,
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer'
  },
  linkBtn: {
    marginTop: 14,
    border: 'none',
    background: 'none',
    color: '#2563eb',
    fontSize: 13,
    cursor: 'pointer'
  }
}
