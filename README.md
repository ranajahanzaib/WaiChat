# WaiChat
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()
[![Build](https://github.com/ranajahanzaib/WaiChat/actions/workflows/ci.yml/badge.svg)](https://github.com/ranajahanzaib/WaiChat/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](./CONTRIBUTING.md)

A Private, Serverless AI Chat App built on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/). Free to run, yours to own, one click to deploy. No backend server, no third-party services, no monthly bills. Deploy in one click and start chatting.

> **Alpha Software** - WaiChat is under active development. Core chat functionality works, but some features are incomplete (auth, UI improvements, mobile layout). Use for personal/testing purposes only.
>
> WaiChat is short for Workers AI Chat

<img width="1435" height="1182" alt="Screenshot 2026-04-12 at 11 23 44 PM" src="https://github.com/user-attachments/assets/7420a62f-09c9-4459-9d3d-9b6fca424c44" />



## Features

- **One-click deploy** - runs entirely on Cloudflare's free tier
- **Multiple AI models** - switch between available Workers AI models on the fly
- **Streaming responses** - real-time output, no waiting
- **Conversation history** - sidebar with past chats, auto-generated titles
- **Flexible storage** - cloud (Cloudflare D1) or local (browser localStorage)
- **Auth-ready** - works out of the box with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) for private deployments

## Deploy

### One-click
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ranajahanzaib/waichat)

Click the **Deploy to Cloudflare** button above. Cloudflare will:

1. Fork this repo into your GitHub account
2. Provision a D1 database and Workers AI binding automatically
3. Build and deploy the app to your `*.workers.dev` subdomain

That's it. No CLI, no config files to edit.

### Manual (CLI)

```bash
git clone https://github.com/ranajahanzaib/waichat.git
cd waichat
pnpm install
pnpm deploy
```

Requires a [Cloudflare account](https://dash.cloudflare.com/sign-up) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

---

## Auth (Optional)

WaiChat does not include built-in authentication. For private deployments, use [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) to gate your app behind a login - supports Google, GitHub, and one-time email PIN out of the box, for free (up to 50 users).

See [docs/self-hosting.md](./docs/self-hosting.md) for a step-by-step setup guide.

---

## Storage

| Mode | How it works |
|---|---|
| **Cloud** | Chat history stored in Cloudflare D1 (SQLite). Default. |
| **Local** | Chat history stored in your browser's localStorage. No data leaves your device. |

Toggle between modes in the app settings.

---

## Tech Stack

- **Frontend** - React + Vite
- **Backend** - Cloudflare Worker + [Hono](https://hono.dev/)
- **AI** - Cloudflare Workers AI (direct binding)
- **Database** - Cloudflare D1
- **Auth** - Cloudflare Access

---

## Free Tier Limits

Everything WaiChat uses fits within Cloudflare's free tier:

| Service | Free allowance |
|---|---|
| Workers AI | 10,000 neurons/day |
| Workers | 100,000 requests/day |
| D1 | 5M reads · 100K writes/day · 5GB storage |
| Pages/Workers hosting | Unlimited |

For personal use, you'll never come close to these limits.

---

## Contributing

We'd love to accept your patches and contributions to this project. There are just a few guidelines you need to follow.

### [Code of Conduct](./CODE_OF_CONDUCT.md)

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) as its Code of Conduct, and we expect all project participants to adhere to it. Kindly read the [full guide](./CODE_OF_CONDUCT.md) to understand what actions will not be tolerated.

### [Contributing Guide](./CONTRIBUTING.md)

Read our [contributing guide](./CONTRIBUTING.md) to learn about our development process, how to propose bug fixes and improvements, and how to build and test your changes to the project.

### Issues

Feel free to submit issues and enhancement requests. Use the template provided when creating an issue to ensure your request is clear and actionable.

See the open issues for a complete list of proposed features (and known issues).

## [License](./LICENSE)

This project is licensed under the [MIT License](./LICENSE), meaning that you're free to modify, distribute, and/or use it for any commercial or private project.
