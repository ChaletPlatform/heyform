// Chalet: scoped visual restyle for the "Get Your Agent Matches" contact-info
// group (email/phone/name) on the two Airbnb realtor forms, matching the
// approved Chalet design spec. Only touches presentation — validation,
// dispatch, and submission all still go through the normal Group/Block
// rendering, this just re-skins the existing DOM via CSS.
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

// `[id$="-<fieldId>"]` matches `heyform-<instanceId>-<fieldId>` regardless of
// the per-session instanceId prefix (see Block.tsx).
const SCOPE = `[id$="-${AIRBNB_CONTACT_GROUP_FIELD_ID}"]`

export const AIRBNB_CONTACT_GROUP_CSS = `
${SCOPE} .heyform-block-wrapper {
  max-width: 560px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #ececee;
  border-radius: 14px;
  box-shadow: 0 20px 50px -28px rgba(63, 46, 128, 0.28);
  padding: 30px 28px 26px;
}
${SCOPE} .heyform-block-title {
  font-weight: 700 !important;
  letter-spacing: -0.02em;
  color: #0a0a0a !important;
}
${SCOPE} .heyform-block-description {
  color: #76707d !important;
  font-size: 1.02rem !important;
  margin-top: 6px;
}
${SCOPE} .heyform-group-children {
  display: grid;
  gap: 18px;
  margin-top: 8px;
}
${SCOPE} .heyform-group-child {
  padding: 0;
}
${SCOPE} .heyform-group-child-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}
${SCOPE} .heyform-group-child-title {
  font-size: 0.92rem;
  font-weight: 600;
}
${SCOPE} .heyform-group-child-required {
  color: #d12e58 !important;
}
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
${SCOPE} .heyform-input {
  padding: 14px 15px !important;
  font-size: 1.02rem !important;
  border: 1px solid #e2e2e2 !important;
  border-radius: 10px !important;
  background: #ffffff !important;
}
${SCOPE} .heyform-input:focus {
  border-color: #5c47b1 !important;
  box-shadow: 0 0 0 3px rgba(92, 71, 177, 0.18) !important;
}
${SCOPE} .heyform-select {
  border: 1px solid #e2e2e2;
  border-radius: 10px 0 0 10px;
  border-right: 0;
}
${SCOPE} .heyform-phone-number .heyform-form-field > div {
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  overflow: hidden;
}
${SCOPE} .heyform-phone-number .heyform-input {
  border: 0 !important;
  border-radius: 0 !important;
}
${SCOPE} .heyform-group-child-statement {
  margin-top: 4px;
}
${SCOPE} .heyform-group-child-statement .heyform-group-child-title {
  font-size: 0.78rem !important;
  line-height: 1.5 !important;
  color: #76707d !important;
  font-weight: 400;
}
${SCOPE} .heyform-group-child-statement a {
  color: #76707d !important;
  text-decoration: underline;
  text-underline-offset: 2px;
}
${SCOPE} .heyform-submit-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 17px 22px !important;
  border-radius: 10px !important;
  background: #5c47b1 !important;
  font-weight: 600 !important;
  font-size: 1.1rem !important;
  box-shadow: 0 10px 24px -12px rgba(92, 71, 177, 0.6);
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
`
