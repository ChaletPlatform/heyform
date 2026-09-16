import { AIRBNB_CONTACT_GROUP_FIELD_ID } from '@heyform-inc/form-renderer/src'

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const MAIL_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#5c47b1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>'
)
const PHONE_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#5c47b1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
)
const USER_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#5c47b1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
)
const ARROW_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'
)
const SHIELD_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#5c47b1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>'
)

const SCOPE = `[id$="-${AIRBNB_CONTACT_GROUP_FIELD_ID}"]`

export const AIRBNB_CONTACT_GROUP_CSS = `
/* ── No card wrapper ── */
${SCOPE} .heyform-block-wrapper {
  background: none !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* ── Title ── */
${SCOPE} .heyform-block-title {
  font-weight: 700 !important;
  letter-spacing: -0.02em;
}
${SCOPE} .heyform-block-description {
  color: #76707d !important;
  font-size: 0.95rem !important;
  line-height: 1.4 !important;
  margin-top: 4px;
}

/* ── Header spacing ── */
${SCOPE} .heyform-block-header {
  margin-bottom: 20px !important;
}

/* ── Field layout ── */
${SCOPE} .heyform-group-children {
  display: grid;
  gap: 16px;
  margin-top: 0;
}
${SCOPE} .heyform-group-child {
  padding: 0;
}

/* ── Labels with icons ── */
${SCOPE} .heyform-group-child-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
${SCOPE} .heyform-group-child-title {
  font-size: 0.9rem;
  font-weight: 600;
}
${SCOPE} .heyform-group-child-required {
  color: #dc2626 !important;
}

/* Icon pseudo-elements */
${SCOPE} .heyform-group-children > .heyform-group-child:nth-child(1) .heyform-group-child-label::before,
${SCOPE} .heyform-group-children > .heyform-group-child:nth-child(3) .heyform-group-child-label::before {
  content: '';
  display: inline-block;
  width: 17px;
  height: 17px;
  flex: none;
  background-repeat: no-repeat;
  background-size: contain;
}
${SCOPE} .heyform-group-children > .heyform-group-child:nth-child(1) .heyform-group-child-label::before {
  background-image: url("${MAIL_ICON}");
}
${SCOPE} .heyform-group-child.heyform-phone-number .heyform-group-child-label::before {
  content: '';
  display: inline-block;
  width: 17px;
  height: 17px;
  flex: none;
  background-image: url("${PHONE_ICON}");
  background-repeat: no-repeat;
  background-size: contain;
}
${SCOPE} .heyform-group-children > .heyform-group-child:nth-child(3) .heyform-group-child-label::before {
  background-image: url("${USER_ICON}");
}

/* ── Inputs ── */
${SCOPE} .heyform-input {
  padding: 12px 14px !important;
  font-size: 1rem !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 10px !important;
  background: #ffffff !important;
  transition: border-color 0.15s, box-shadow 0.15s;
}
${SCOPE} .heyform-input:hover {
  border-color: #d1d5db !important;
}
${SCOPE} .heyform-input:focus {
  border-color: #5c47b1 !important;
  box-shadow: 0 0 0 3px rgba(92, 71, 177, 0.18) !important;
}

/* ── Phone number: wrap select+input in a clean bordered box ── */
${SCOPE} .heyform-phone-number .heyform-form-field > div {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  transition: border-color 0.15s, box-shadow 0.15s;
}
${SCOPE} .heyform-phone-number .heyform-form-field > div:focus-within {
  border-color: #5c47b1;
  box-shadow: 0 0 0 3px rgba(92, 71, 177, 0.18);
}
/* Reset the select's own borders/padding — the outer wrapper handles it */
${SCOPE} .heyform-phone-number .heyform-select {
  border: none !important;
  border-right: 1px solid #e5e7eb !important;
  border-radius: 0 !important;
  width: auto !important;
  padding: 0 10px !important;
}
${SCOPE} .heyform-phone-number .heyform-select-container {
  padding-bottom: 0 !important;
  border-bottom: none !important;
}
/* Strip the input's own border inside the phone wrapper */
${SCOPE} .heyform-phone-number .heyform-input {
  border: 0 !important;
  border-radius: 0 !important;
  margin-left: 0 !important;
  width: 100% !important;
  flex: 1 1 0% !important;
}
${SCOPE} .heyform-phone-number .heyform-input:focus {
  box-shadow: none !important;
}

/* ── Error states: consistent across all fields ── */
${SCOPE} .heyform-validation-wrapper {
  margin-top: 6px;
}
${SCOPE} .heyform-validation-error {
  border: none !important;
  border-radius: 6px;
  font-size: 0.82rem;
}
${SCOPE} .heyform-phone-number .heyform-validation-wrapper {
  border: none !important;
  box-shadow: none !important;
  background: none !important;
}

/* ── Trust badge (before statement) ── */
${SCOPE} .heyform-group-child-statement {
  margin-top: 2px;
}
${SCOPE} .heyform-group-child-statement::before {
  content: 'Your information is secure \\2014  We only use your information to match you with vetted short-term rental real estate agents. We will never sell your information or share it with third parties for marketing purposes.';
  display: block;
  width: 100%;
  padding: 12px 16px 12px 46px;
  margin-bottom: 10px;
  background: rgba(92, 71, 177, 0.06);
  border-radius: 10px;
  background-image: url("${SHIELD_ICON}");
  background-repeat: no-repeat;
  background-position: 14px 14px;
  background-size: 22px 22px;
  font-size: 0.78rem;
  line-height: 1.55;
  color: #6b7280;
}

/* ── Statement / disclaimer ── */
${SCOPE} .heyform-group-child-statement .heyform-group-child-title {
  font-size: 0.78rem !important;
  line-height: 1.6 !important;
  color: #6b7280 !important;
  font-weight: 400;
}
${SCOPE} .heyform-group-child-statement a {
  color: #6b7280 !important;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Submit area ── */
${SCOPE} .heyform-group-submit {
  margin-top: 16px !important;
}
${SCOPE} .heyform-submit-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 24px !important;
  border-radius: 10px !important;
  background: #5c47b1 !important;
  font-weight: 600 !important;
  font-size: 1rem !important;
  transition: background 0.15s;
}
${SCOPE} .heyform-submit-button:hover {
  background: #4f3a9e !important;
}
${SCOPE} .heyform-submit-button:active {
  background: #3f2e80 !important;
}
${SCOPE} .heyform-submit-button::after {
  content: '';
  display: inline-block;
  width: 18px;
  height: 18px;
  background-image: url("${ARROW_ICON}");
  background-repeat: no-repeat;
  background-size: contain;
}

/* ── Trust marks below submit ── */
${SCOPE} .heyform-submit-container {
  margin-top: 0 !important;
}
/* ── Trust marks below submit ── */
${SCOPE} .heyform-group-submit::after {
  content: '\\2713\\a0 Free, always \\a0\\a0\\a0\\a0\\a0 \\2713\\a0 No obligation \\a0\\a0\\a0\\a0\\a0 \\2713\\a0 Intro in 24 hours';
  display: block;
  text-align: center;
  margin-top: 14px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7280;
}

/* ── Mobile compactness ── */
@media (max-width: 640px) {
  ${SCOPE} .heyform-block-title {
    font-size: 1.25rem !important;
  }
  ${SCOPE} .heyform-block-description {
    font-size: 0.8rem !important;
    margin-top: 3px;
    line-height: 1.4 !important;
  }
  ${SCOPE} .heyform-block-header {
    margin-bottom: 16px !important;
  }
  ${SCOPE} .heyform-group-children {
    gap: 12px;
  }
  ${SCOPE} .heyform-group-child-label {
    margin-bottom: 4px;
    gap: 6px;
  }
  ${SCOPE} .heyform-group-child-label::before {
    width: 15px !important;
    height: 15px !important;
  }
  ${SCOPE} .heyform-group-child-title {
    font-size: 0.82rem;
  }
  ${SCOPE} .heyform-input {
    padding: 10px 12px !important;
    font-size: 0.9rem !important;
    border-radius: 8px !important;
  }
  ${SCOPE} .heyform-phone-number .heyform-form-field > div {
    border-radius: 8px;
  }
  ${SCOPE} .heyform-group-child-statement {
    margin-top: 0;
  }
  ${SCOPE} .heyform-group-child-statement::before {
    padding: 10px 12px 10px 38px;
    margin-bottom: 8px;
    font-size: 0.7rem;
    border-radius: 8px;
    background-position: 10px 10px;
    background-size: 18px 18px;
  }
  ${SCOPE} .heyform-group-child-statement .heyform-group-child-title {
    font-size: 0.68rem !important;
    line-height: 1.5 !important;
  }
  ${SCOPE} .heyform-group-submit {
    margin-top: 12px !important;
  }
  ${SCOPE} .heyform-submit-button {
    padding: 12px 18px !important;
    font-size: 0.95rem !important;
    border-radius: 8px !important;
  }
  ${SCOPE} .heyform-group-submit::after {
    font-size: 0.7rem;
    margin-top: 10px;
  }
}
`
