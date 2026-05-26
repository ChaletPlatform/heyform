# Chalet Changes to HeyForm

This document tracks every modification Chalet has made on top of the upstream
[heyform/heyform](https://github.com/heyform/heyform) codebase. It is the
single source of truth for what we changed, why, and where — so future upstream
merges stay easy.

**Upstream base:** `next` branch
**Chalet branches:** `chalet/trustedform` (production), `chalet/group-page-rendering` (feature)

---

## 1. TrustedForm Certificate Capture

**Purpose:** Capture a TrustedForm certificate URL with every form submission for
TCPA-compliant lead generation.

### Files Changed

| File | Change |
|------|--------|
| `packages/server/view/index.html` | Injected TrustedForm SDK script before `</body>`. Loads `trustedform.js` asynchronously and writes the certificate URL into a hidden input named `xxTrustedFormCertUrl`. |
| `packages/webapp/src/pages/form/Render/components/Renderer.tsx` (~line 149) | Added DOM fallback for hidden fields. When a hidden field value isn't found in URL query params, it checks `document.querySelector('input[name="..."]')` to read values injected by third-party SDKs like TrustedForm. |

### How It Works

1. TrustedForm SDK loads on every form page and creates a hidden `<input name="xxTrustedFormCertUrl">` in the DOM.
2. In the HeyForm builder, a hidden field named `xxTrustedFormCertUrl` is added to each form.
3. On submission, `Renderer.tsx` reads the hidden field value — first from URL params, then falling back to the DOM input.
4. The certificate URL is submitted alongside the form answers and appears in HeyForm's submissions table.

### Merge Notes

- `index.html`: Append-only addition before `</body>`. No conflict unless upstream restructures the HTML shell.
- `Renderer.tsx`: Small conditional block (~8 lines) added inside the `hiddenFields.map()` callback. Easy to re-apply if upstream modifies the surrounding code.

---

## 2. Group Page Rendering (Multi-Question Pages)

**Purpose:** Display all children of a question group on a single page instead of
HeyForm's default one-question-per-page behavior. Used for the lead capture form
(first name, last name, phone, email shown together).

### Files Changed

| File | Change | Lines |
|------|--------|-------|
| `packages/form-renderer/src/blocks/Group.tsx` | **New file.** Renders a GROUP field with all its children as a single form page. Uses one `rc-field-form` instance wrapping all child inputs. Handles validation, submission, loading state, error display, real-time value sync, and embed mode. | ~360 |
| `packages/form-renderer/src/views/Blocks.tsx` | Added `GROUP` case to `getBlock()` switch. Added `effectiveField` memo that redirects group children to their parent for rendering. Updated transition logic to use `effectiveField`. | +22 |
| `packages/form-renderer/src/store.ts` | Made `scrollNext`, `scrollPrevious`, and `scrollToField` group-aware. Navigation skips past group children as a unit. | +35 |
| `packages/form-renderer/src/style.scss` | Appended `.heyform-group` styles (children layout, labels, required indicator, submit spacing). | +46 |

### Architecture Decisions

- **`flattenFieldsWithGroups()` is untouched.** Children remain as individual entries in `state.fields` with a `parent` reference. This preserves all existing validation, submission, progress tracking, sidebar, and builder logic.
- **No changes to `Form.tsx`, `Block.tsx`, or any existing block component.** Group.tsx uses the raw input components (`Input`, `PhoneNumberInput`, `Textarea`) directly from `../components`.
- **No backend/API changes.** Values are keyed by child field ID, same as standalone fields.

### How It Works

```
Form builder:  fields = [A, Group{children: [C1, C2, C3]}, B]

After flattenFieldsWithGroups (UNCHANGED):
  state.fields = [A, Group(empty), C1(parent=Group), C2(parent=Group), C3(parent=Group), B]

Renderer lands on Group → Group.tsx renders C1, C2, C3 together
Renderer lands on C1/C2/C3 → effectiveField redirects to Group → same page

Navigation:
  Next from A      → lands on Group (scrollIndex + 1)
  Next from Group  → skips C1, C2, C3 → lands on B
  Previous from B  → detects C3 has parent → jumps to field before Group → lands on A
```

### Supported Child Field Types

| Kind | Rendering |
|------|-----------|
| `SHORT_TEXT` | Single text input (default fallback) |
| `EMAIL` | Email input with type validation |
| `FULL_NAME` | Side-by-side first/last name inputs |
| `PHONE_NUMBER` | Phone input with country code picker |
| `NUMBER` | Numeric input |
| `LONG_TEXT` | Textarea |

Other kinds fall back to a plain text input.

### Merge Notes

- `Group.tsx`: New file — zero conflict possible.
- `Blocks.tsx`: Only conflicts if upstream adds a GROUP case to `getBlock()` (currently falls through to Statement). The `effectiveField` wrapper is additive.
- `store.ts`: Additions are isolated at the top of each scroll function with early returns. Original logic is untouched below.
- `style.scss`: Appended at end with new class names. No existing selectors modified.

---

## 3. Email Domain Registration Restriction

**Purpose:** Prevent unauthorized signups on our self-hosted instance by restricting
registration to specific email domains.

### Files Changed

| File | Change |
|------|--------|
| `packages/server/src/environments/index.ts` | Added `ALLOWED_EMAIL_DOMAINS` env var. Parses a comma-separated list of allowed domains from `process.env.ALLOWED_EMAIL_DOMAINS`. Empty means all domains allowed. |
| `packages/server/src/resolver/auth/sign-up.resolver.ts` | Added domain check after the disposable email check. Rejects signups from non-allowed domains with a `BadRequestException`. |
| `packages/server/src/service/social-login.service.ts` | Added same domain check in the social login registration path so new users via Google/Apple login are also restricted. |

### How It Works

1. Set `ALLOWED_EMAIL_DOMAINS=getchalet.com` in `.env` (comma-separated for multiple domains).
2. New signups (email or social login) are rejected if the email domain is not in the list.
3. Existing users can still log in regardless — the check only applies to new registrations.
4. If the variable is unset or empty, all domains are allowed (backwards-compatible).

### Merge Notes

- `environments/index.ts`: Single export added after `APP_DISABLE_REGISTRATION`. No conflict unless upstream modifies the same line.
- `sign-up.resolver.ts`: Small conditional block (~5 lines) added after the disposable email check. Easy to re-apply.
- `social-login.service.ts`: Small conditional block (~5 lines) added after the `APP_DISABLE_REGISTRATION` check. Easy to re-apply.

---

## 4. CI/CD Pipeline

**Purpose:** Automatically build and push the Docker image on code changes.

### Files Added

| File | Purpose |
|------|---------|
| `.github/workflows/ghcr-publish.yml` | GitHub Actions workflow. Triggers on push to `chalet/trustedform` when `packages/**`, `Dockerfile`, `pnpm-lock.yaml`, or `package.json` change. Builds linux/amd64 image and pushes to GHCR with `latest` and SHA tags. Uses BuildKit GHA caching. |

### Merge Notes

New file in `.github/workflows/` — no conflict with upstream workflows.

---

## 5. Deployment Configuration

**Purpose:** Production and test Docker Compose configs, environment template, and deploy docs.

### Files Added/Changed

| File | Purpose |
|------|---------|
| `DEPLOY.md` | Full deployment guide: architecture overview, local dev setup, production deployment on EC2 with Caddy, and operational runbooks. |
| `.env.example` | Template for all required environment variables (SESSION_KEY, FORM_ENCRYPTION_KEY, MONGO_URI, SMTP config, APP_HOMEPAGE_URL). |
| `docker-compose.prod.yml` | Production compose: HeyForm + Caddy (HTTPS via Let's Encrypt) + KeyDB. MongoDB is external (Atlas). |
| `docker-compose.test.yml` | Local test compose: HeyForm + KeyDB + Mailpit (email testing). Ports: 9157 (app), 8025 (mail UI), 1025 (SMTP). |

### Merge Notes

All new files except `docker-compose.test.yml` (existed upstream but was heavily modified). On merge, keep our version.

---

## Files NOT Changed (and why)

These files are commonly assumed to need changes but are deliberately untouched:

| File/Package | Why untouched |
|--------------|---------------|
| `packages/form-renderer/src/utils/form.ts` (`flattenFieldsWithGroups`) | Used by the builder's logic editor. Children stay as individual `state.fields` entries. |
| `packages/form-renderer/src/blocks/Form.tsx` | Group.tsx has its own `rc-field-form`. No props added. |
| `packages/form-renderer/src/blocks/Block.tsx` | Used as outer wrapper only. Children rendered with lightweight markup. |
| All existing block components (ShortText, Email, etc.) | Not reused inside Group — raw input components used directly. |
| `packages/answer-utils/` | `fieldsToValidateRules` already handles individual child fields. `validateFields` works as-is. |
| `packages/shared-types-enums/` | No new field kinds or settings needed. |
| Backend / API / Database | Values keyed by field ID. Group children have individual IDs. Nothing changes server-side. |

---

## Upstream Merge Checklist

When pulling from `heyform/heyform` `next` branch:

1. **`Blocks.tsx`** — Check if upstream added a `GROUP` case to `getBlock()`. If so, replace with ours.
2. **`store.ts`** — Check if `scrollNext`/`scrollPrevious`/`scrollToField` signatures changed. Re-apply our additions at the top of each function.
3. **`style.scss`** — Our styles are appended at the end. Re-append if the file was regenerated.
4. **`Renderer.tsx`** — Check if the `hiddenFields.map()` callback changed. Re-apply our DOM fallback.
5. **`index.html`** — Re-add TrustedForm script if the HTML shell was rewritten.
6. **`environments/index.ts`** — Re-add `ALLOWED_EMAIL_DOMAINS` export if upstream modifies the file.
7. **`sign-up.resolver.ts`** — Re-apply domain check after disposable email check.
8. **`social-login.service.ts`** — Re-apply domain check after `APP_DISABLE_REGISTRATION` check.
9. **Everything else** — Should merge cleanly (new files or config-only changes).

Estimated merge effort per upstream update: **< 10 minutes**.
