# Deployment Guide

This is the Chalet fork of HeyForm with [TrustedForm](https://activeprospect.com/trustedform/) certificate capture baked in.

## Architecture

| Component | What it is |
|-----------|-----------|
| **HeyForm** | Node.js app (port 9157) — our custom Docker image |
| **Caddy** | Reverse proxy — handles HTTPS automatically via Let's Encrypt |
| **KeyDB** | Redis-compatible cache |
| **MongoDB Atlas** | Hosted database — external, not in compose |
| **Google Workspace SMTP relay** | Outbound email — no auth, allowed by EC2 IP |

**Production URL:** https://forms.getchalet.com  
**EC2 instance:** `34.214.175.119` (t3.small, us-west-2, SSH alias: `heyform-instance`)  
**Files live at:** `/opt/heyform/` on the instance

---

## Local Development

### Prerequisites
- Docker + Docker Compose
- Access to MongoDB Atlas (or a local MongoDB instance)

### Steps

```bash
# 1. Clone and checkout the branch
git clone git@github.com:ChaletPlatform/heyform.git
cd heyform
git checkout chalet/trustedform

# 2. Set up environment
cp .env.example .env
# Edit .env — fill in SESSION_KEY, FORM_ENCRYPTION_KEY, MONGO_URI

# Generate keys if you don't have them:
openssl rand -hex 32   # use output for SESSION_KEY
openssl rand -hex 32   # use output for FORM_ENCRYPTION_KEY

# 3. Build the image
docker build -t heyform-chalet:latest .

# 4. Start everything
docker compose -f docker-compose.test.yml up -d

# 5. Open
open http://localhost:9157        # HeyForm
open http://localhost:8025        # Mailpit (catches all emails)
```

---

## CI/CD

**Workflow:** `.github/workflows/ghcr-publish.yml`

- **Triggers on:** push to `chalet/trustedform`
- **Builds:** `linux/amd64` Docker image
- **Pushes to:** `ghcr.io/chaletplatform/heyform:latest` and `ghcr.io/chaletplatform/heyform:<commit-sha>`
- **Auth:** uses built-in `GITHUB_TOKEN` — no secrets to configure

The GHCR package is **private**. The EC2 instance is authenticated with a GitHub PAT stored in `/home/ec2-user/.docker/config.json`.

---

## Production Deployment

### First-time setup (already done)

```bash
# SSH into the instance
ssh heyform-instance

# Files are at /opt/heyform/
ls /opt/heyform/
# docker-compose.yml  Caddyfile  .env  assets/
```

### Deploying a new image

```bash
ssh heyform-instance "cd /opt/heyform && docker compose pull && docker compose up -d"
```

Or let CI handle it — every push to `chalet/trustedform` builds a new image tagged `:latest`.

### Updating config / .env

```bash
# Edit .env on the instance
ssh heyform-instance "nano /opt/heyform/.env"

# Restart heyform to pick up changes (caddy and keydb don't need restart)
ssh heyform-instance "cd /opt/heyform && docker compose restart heyform"
```

### Viewing logs

```bash
# All services
ssh heyform-instance "cd /opt/heyform && docker compose logs -f"

# Just heyform
ssh heyform-instance "cd /opt/heyform && docker compose logs -f heyform"

# Just caddy (SSL cert issues show up here)
ssh heyform-instance "cd /opt/heyform && docker compose logs -f caddy"
```

---

## DNS & SSL

Caddy auto-provisions an SSL cert via Let's Encrypt as soon as the DNS A record resolves.

| Record | Type | Value |
|--------|------|-------|
| `forms.getchalet.com` | A | `34.214.175.119` |

**MongoDB Atlas** must also have `34.214.175.119` on its IP allowlist:  
Atlas → Network Access → Add IP Address → `34.214.175.119`

---

## SMTP

Production uses **Google Workspace SMTP relay** — no credentials required, authenticated by EC2 IP (`34.214.175.119`).

```
SMTP_FROM=HeyForm <noreply@getchalet.com>
SMTP_HOST=smtp-relay.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_IGNORE_CERT=false
```

For local dev, `docker-compose.test.yml` runs **Mailpit** instead — it catches all outgoing email without sending anything. Web UI at `http://localhost:8025`.

---

## PostHog Session Replay

Form pages embed a PostHog snippet so the parent app (`www.getchalet.com`) can capture form interactions in cross-origin iframe session replays.

### How it works

1. **Parent (getchalet.com)** initializes PostHog with `session_recording: { recordCrossOriginIframes: true }` in `instrumentation-client.ts`. API calls are proxied via `/chalet-ph` → `us.i.posthog.com` (configured in `next.config.ts` rewrites).
2. **Child iframe (forms.getchalet.com)** initializes PostHog with the same project key and `session_recording: { recordCrossOriginIframes: true }` via the CDN snippet in `view/index.html`. API calls are proxied via `/chaletforms-ph` → `us.i.posthog.com` (configured in the Caddyfile).
3. Both **must use the same PostHog project API key** for the cross-origin `postMessage` bridge to connect.
4. The child iframe does not send its own session recordings — it pipes DOM snapshots to the parent via `postMessage`, which includes them in the parent's recording.

### Reverse proxy (Caddyfile)

Caddy proxies PostHog requests to avoid ad blockers and ensure the `/decide` call succeeds (which enables session recording in the iframe):

```
forms.getchalet.com {
    handle /chaletforms-ph/static/* {
        uri strip_prefix /chaletforms-ph
        reverse_proxy https://us-assets.i.posthog.com {
            header_up Host us-assets.i.posthog.com
        }
    }

    handle /chaletforms-ph/* {
        uri strip_prefix /chaletforms-ph
        reverse_proxy https://us.i.posthog.com {
            header_up Host us.i.posthog.com
        }
    }

    handle {
        reverse_proxy heyform:9157
    }
}
```

### Required env vars

Set on the EC2 box in `/opt/heyform/.env`:

```
POSTHOG_KEY=<phc_... — same value as NEXT_PUBLIC_POSTHOG_KEY in chalet-nextjs>
POSTHOG_HOST=https://forms.getchalet.com/chaletforms-ph
```

- `POSTHOG_KEY` — client-side project key (not a secret, ships in browser bundles). Must match the parent app's key. Leave blank to disable the snippet (gated by `{{#if heyform.posthogKey}}` in `view/index.html`).
- `POSTHOG_HOST` — points to the Caddy reverse proxy, not directly to PostHog.

### Verify

```bash
# Check the snippet renders with the correct key
curl -s https://forms.getchalet.com/form/<FORM_ID> | grep -o "posthog.init('phc_[^']*'"
# Should print: posthog.init('phc_...'

# Check the reverse proxy works
curl -s -o /dev/null -w "%{http_code}" "https://forms.getchalet.com/chaletforms-ph/decide?v=3"
# Should print: 200
```

### Troubleshooting

If the iframe content doesn't appear in session replays:

1. **Check keys match** — both parent and child must use the same PostHog project API key.
2. **Check recording starts** — in Chrome DevTools, select the `forms.getchalet.com` iframe context from the console dropdown, then run `window.posthog.sessionRecording?.started`. Must be `true`.
3. **Check proxy works** — `curl https://forms.getchalet.com/chaletforms-ph/decide?v=3` should return 200.
4. **Check PostHog project settings** — no URL triggers or domain restrictions should block `forms.getchalet.com`.

---

## PostHog Engagement Analytics

Beyond session replay, the form renderer fires structured PostHog events for per-question engagement tracking, drop-off analysis, and funnel reporting.

### Events

All events include `form_id`, `session_id` (anonymous, stable per session), and `question_count`.

| Event | When it fires | Extra properties |
|-------|--------------|-----------------|
| `heyform_loaded` | Form page renders | — |
| `heyform_started` | User clicks Start (welcome screen) or answers first question (no welcome) | — |
| `heyform_question_viewed` | Each question renders | `question_id`, `question_index`, `question_title`, `question_type` |
| `heyform_question_answered` | User completes a question | `question_id`, `question_index`, `question_title`, `question_type` |
| `heyform_submitted` | Successful submission | `completion_time_seconds`, `answers_count` |
| `heyform_abandoned` | Tab close / visibility hidden (only if user started but didn't submit) | `last_question_index`, `last_question_id`, `answers_count`, `completion_pct` |

### What you can build in PostHog

- **Form funnel:** loaded → started → Q1 viewed → Q2 viewed → ... → submitted
- **Per-question drop-off:** filter `heyform_question_viewed` by `question_index`, compare counts
- **Submit rate:** submitted / loaded (or submitted / started)
- **Completion time:** `completion_time_seconds` on `heyform_submitted`
- **Abandonment analysis:** `heyform_abandoned` → `last_question_index` shows where users leave

### Implementation

The tracking lives in a single React hook:
- `packages/form-renderer/src/hooks/usePostHogTracking.ts` — fires events via `window.posthog?.capture()`
- Wired into `packages/form-renderer/src/views/Blocks.tsx` — one `usePostHogTracking()` call

No PostHog npm package — uses the global `window.posthog` from the CDN snippet. Gracefully no-ops if PostHog isn't configured.

### Conditional branching

Forms with logic/branching work automatically. The `state.fields` array is already filtered by `applyLogicToFields()` — events only fire for questions the user actually sees. PostHog funnels handle divergent paths natively.

---

## EC2 GHCR Authentication

The GHCR image is private. Docker on the EC2 box authenticates via a GitHub Personal Access Token stored in `/root/.docker/config.json` (root because `sudo docker compose` is what compose runs as).

**To set up or refresh:**

1. Generate a **classic** PAT at https://github.com/settings/tokens (not fine-grained — those don't work cleanly with org-owned GHCR packages). Scope: `read:packages` only. Expiration: prefer "No expiration" or set a calendar reminder.
2. On the EC2 box:
   ```bash
   echo 'ghp_xxxx' | sudo docker login ghcr.io -u <github-username> --password-stdin
   ```
3. The login persists. Future `sudo docker compose pull` works without re-auth.

**If `pull` returns `denied` after successful login**, the user has GitHub access but not package access. Grant at:
https://github.com/orgs/ChaletPlatform/packages/container/heyform/settings → Manage Actions access → invite user (Read).

---

## Troubleshooting

### Container crash loops on startup with `ERR_REQUIRE_ESM`

A regenerated `pnpm-lock.yaml` likely pulled in an ESM-only version of a dep (e.g. `uuid@13+`) that HeyForm's CJS code can't `require()`. Fix:

```bash
# On your laptop, in the heyform repo on chalet/trustedform
git checkout <last-known-good-commit> -- pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "fix: revert lockfile to working state"
git push
# Wait for CI green, then redeploy
```

Don't include lockfile regenerations in commits unless you've tested the build locally first.

### Force-recreate the running container

```bash
cd /opt/heyform && \
sudo docker compose pull heyform && \
sudo docker compose up -d --force-recreate heyform
```

`--force-recreate` matters — without it compose may keep the running container even after a fresh image is pulled.

### Roll back to a previous image

Every CI build pushes both `:latest` and `:<short-sha>` tags to GHCR. To roll back:

```bash
sudo docker pull ghcr.io/chaletplatform/heyform:<old-sha>
# Edit /opt/heyform/docker-compose.yml — change image tag from :latest to :<old-sha>
sudo docker compose up -d --force-recreate heyform
```

Form data lives in MongoDB Atlas — container rollbacks/restarts never touch it.

### Watch what the container actually has

```bash
sudo docker exec heyform-heyform-1 sh -c 'echo $POSTHOG_KEY'     # env vars
sudo docker compose logs --tail=80 heyform                        # logs
sudo docker compose ps                                            # status
```

---

## Remaining Tasks

- [x] Point `forms.getchalet.com` DNS A record to `34.214.175.119`
- [x] Whitelist `34.214.175.119` in MongoDB Atlas Network Access
- [x] Switch from Mailpit to Google Workspace SMTP relay
- [ ] Configure `xxTrustedFormCertUrl` hidden field in each HeyForm form
- [ ] Migrate Typeform embeds → HeyForm embeds (8 form IDs, 38+ files in Chalet frontend)
- [ ] Add webhook to forward submissions to Chalet backend
