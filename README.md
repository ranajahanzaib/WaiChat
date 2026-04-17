<div align="center">
  
  <img alt="WaiChat Logo" height="128" alt="waichat" src="https://github.com/user-attachments/assets/032b440a-fdd6-421d-a1ff-1c89287e1ee6" />

  <h1>WaiChat</h1>
  
  [![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()
  [![Build](https://github.com/ranajahanzaib/WaiChat/actions/workflows/ci.yml/badge.svg)](https://github.com/ranajahanzaib/WaiChat/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](./CONTRIBUTING.md)
  
</div>

A Private, Serverless AI Chat App built on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/). Free to run, yours to own, one click to deploy. No backend server, no third-party services, no monthly bills. Deploy in one click and start chatting.

> _WaiChat is in active development. Core chat is functional, but authentication and UI/UX are still being refined. Use for testing/personal purposes only. Track progress or suggest fixes [here](https://github.com/users/ranajahanzaib/projects/33/views/3)._
>
> _**WaiChat is short for Workers AI Chat**_


<img width="1432" height="1053" alt="Screenshot 2026-04-15 at 10 36 11 PM" src="https://github.com/user-attachments/assets/09dd3b82-eeb7-4175-ad61-cd029e3926f3" />

<img width="1553" height="1117" alt="Screenshot 2026-04-15 at 10 37 58 PM" src="https://github.com/user-attachments/assets/fb8456b4-74c7-4b1b-ba2d-06473990f628" />

https://github.com/user-attachments/assets/e62c3a84-aa5d-4d24-be3f-f162115db89a

## Features

- **One-click deploy** - runs entirely on Cloudflare's free tier
- **Modern interface** - responsive, native-feeling glassmorphic UI with Light, Dark, and System themes
- **Multiple AI models** - switch between available Workers AI models on the fly with in-chat attribution
- **Smart streaming** - real-time output featuring beautifully parsed, collapsible `<think>` blocks for reasoning models
- **Flexible workspaces** - instantly toggle between cloud (Cloudflare D1) and local (browser localStorage) environments
- **Chat management** - collapsible sidebar, auto-generated titles, one-click copy actions, and deep-linked URLs
- **Auth-ready** - works out of the box with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) for zero-trust private deployments


## Deploy

### One-click
The easiest way to self-host WaiChat is via the Deploy to Cloudflare button below.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ranajahanzaib/WaiChat/tree/v0.1.2-alpha)

Click the button and Cloudflare handles everything automatically - no CLI, no config files to edit, no manual steps required. Behind the scenes it forks the repo into your GitHub account, provisions a D1 database and Workers AI binding, then builds and deploys the app to `https://waichat.<your-subdomain>.workers.dev`.

### Manual (CLI)

Requires a [Cloudflare account](https://dash.cloudflare.com/sign-up) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
git clone https://github.com/ranajahanzaib/waichat.git
cd waichat
pnpm install

# 1. Create your D1 database
npx wrangler d1 create waichat-db

# 2. Set up your local wrangler config
cp wrangler.local.toml.example wrangler.local.toml
# Open wrangler.local.toml and paste your new database_id inside

# 3. Migrate and deploy
pnpm db:migrate:remote
pnpm deploy:production
```


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

### Issues & Roadmap

We build in public! All active development, upcoming features, and known bugs are tracked on our **[WaiChat Public Roadmap](https://github.com/users/ranajahanzaib/projects/33)**.

Feel free to submit issues and enhancement requests. Use the template provided when creating an issue to ensure your request is clear and actionable. If you are looking for something to work on, check out the **Bug Tracker** or **To Do** columns on the project board.

## [License](./LICENSE)

This project is licensed under the [MIT License](./LICENSE), meaning that you're free to modify, distribute, and/or use it for any commercial or private project.
