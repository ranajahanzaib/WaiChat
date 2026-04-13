# Self-Hosting Guide

WaiChat deploys entirely on Cloudflare's free tier. This guide covers optional configuration for private deployments, including authentication via Cloudflare Access and live model fetching.

---

## One-Click Deploy

The easiest way to self-host WaiChat is via the Deploy to Cloudflare button below.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ranajahanzaib/waichat)

Click the button and Cloudflare handles everything automatically - no CLI, no config files to edit, no manual steps required. Behind the scenes it forks the repo into your GitHub account, provisions a D1 database and Workers AI binding, then builds and deploys the app to `https://waichat.<your-subdomain>.workers.dev`.

---

## Manual Deploy (CLI)

If you prefer to deploy manually:

```bash
git clone https://github.com/ranajahanzaib/waichat.git
cd waichat
pnpm install
pnpm db:migrate:remote   # apply D1 schema to remote database
pnpm deploy:production   # build client and deploy worker
```

Requires a [Cloudflare account](https://dash.cloudflare.com/sign-up) and your `CLOUDFLARE_API_TOKEN` set as an environment variable.

---

## Authentication (Cloudflare Access)

By default, WaiChat is publicly accessible to anyone with the URL. To restrict access to specific users, enable Cloudflare Access directly from the Workers dashboard - free for up to 50 users, no zone or DNS configuration needed.

### Enable Cloudflare Access

**1. Open your Worker in the Cloudflare dashboard**

Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → select your WaiChat worker.

**2. Go to Settings → Domains & Routes**

You'll see two rows:

| Type | Value |
|---|---|
| workers.dev | `waichat.<your-subdomain>.workers.dev` |
| Preview URLs | *(preview deployments)* |

**3. Enable Access on each domain**

Click the **⋯** menu on the right of each row and toggle **Cloudflare Access** on. Repeat for Preview URLs if you want those protected too. If you add a custom domain later, enable it there as well.

**4. Configure your Access policy**

After enabling, click the **⋯** menu again - you'll now see a **Manage Cloudflare Access** option. Click it to open the Access Control → Applications page in a new tab, where you can configure who is allowed in:

- Edit the policy to allow specific emails, or connect Google, GitHub, Microsoft, or any SAML/OIDC provider under **Settings → Authentication → Login methods**

**5. Test it**

Visit your WaiChat URL. You'll be prompted to authenticate. After verifying, you'll have full access.

> **⚠️ Local Development Note:** Cloudflare Access blocks Wrangler's remote proxy session, which breaks `pnpm dev:worker`. Disable Cloudflare Access on your workers.dev domain while developing locally, then re-enable when done.

---

## Live Model Fetching (Optional)

By default, WaiChat uses a hardcoded list of Workers AI models. To fetch the live model list directly from Cloudflare's API (so you always see the latest available models), set these secrets:

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
# enter your account ID from dash.cloudflare.com

wrangler secret put CLOUDFLARE_API_TOKEN
# enter an API token with Workers AI Read permission
```

Your account ID is visible in the URL when logged into the Cloudflare dashboard: `dash.cloudflare.com/<account-id>`.

To create a scoped API token:
- Go to **My Profile → API Tokens → Create Token**
- Use the **Read Workers AI** template or create a custom token with `Workers AI: Read` permission

Once set, `/api/models` will return the full live list sorted by recency and capability.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | No | Enables live model fetching from Cloudflare API |
| `CLOUDFLARE_API_TOKEN` | No | Required alongside `CLOUDFLARE_ACCOUNT_ID` |

All other configuration (D1 binding, Workers AI binding) is handled automatically via `wrangler.toml`.

---

## Local Development

```bash
pnpm install
pnpm db:migrate:local    # apply D1 schema locally
pnpm dev:worker          # start Worker on localhost:8787
pnpm dev:client          # start Vite dev server on localhost:5173
```

Add your credentials to `.env.local` for local development:

```bash
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here  # optional, for live models
```

Never commit `.env.local` - it's already in `.gitignore`.
