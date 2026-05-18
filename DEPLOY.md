# Deployment Guide

This is the Chalet fork of HeyForm with [TrustedForm](https://activeprospect.com/trustedform/) certificate capture baked in.

## Architecture

| Component | What it is |
|-----------|-----------|
| **HeyForm** | Node.js app (port 9157) — our custom Docker image |
| **Caddy** | Reverse proxy — handles HTTPS automatically via Let's Encrypt |
| **KeyDB** | Redis-compatible cache |
| **Mailpit** | Local SMTP catch-all (dev/staging only) |
| **MongoDB Atlas** | Hosted database — external, not in compose |

**Production URL:** https://forms.getchalet.com  
**EC2 instance:** `52.27.132.23` (t3.small, us-west-2, SSH alias: `heyform-instance`)  
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

### Viewing Mailpit (email catcher)

Mailpit's web UI is bound to `127.0.0.1:8025` on the instance (not exposed publicly). Use an SSH tunnel:

```bash
ssh -L 8025:localhost:8025 heyform-instance
# Then open http://localhost:8025
```

---

## DNS & SSL

Caddy auto-provisions an SSL cert via Let's Encrypt as soon as the DNS A record resolves.

| Record | Type | Value |
|--------|------|-------|
| `forms.getchalet.com` | A | `52.27.132.23` |

**MongoDB Atlas** must also have `52.27.132.23` on its IP allowlist:  
Atlas → Network Access → Add IP Address → `52.27.132.23`

---

## Switching to Real SMTP (when ready)

Replace the `mailpit` SMTP block in `.env` on the instance:

```bash
# Gmail app password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@getchalet.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_SECURE=false
SMTP_IGNORE_CERT=false

# Then remove mailpit from docker-compose.prod.yml and restart
docker compose up -d --remove-orphans
```

---

## Remaining Tasks

- [ ] Point `forms.getchalet.com` DNS A record to `52.27.132.23`
- [ ] Whitelist `52.27.132.23` in MongoDB Atlas Network Access
- [ ] Switch from Mailpit to real SMTP (Gmail app password or Amazon SES)
- [ ] Configure `xxTrustedFormCertUrl` hidden field in each HeyForm form
- [ ] Migrate Typeform embeds → HeyForm embeds (8 form IDs, 38+ files in Chalet frontend)
- [ ] Add webhook to forward submissions to Chalet backend
