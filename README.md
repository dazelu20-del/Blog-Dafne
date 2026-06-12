# The Fashion Web

**Live site:** [https://blog-dafne.dazelu20.workers.dev/](https://blog-dafne.dazelu20.workers.dev/)

*The fashion tips and trends coming right up.*

## About

**The Fashion Web** is a personal fashion blog with a soft girl aesthetic — pastel pinks, lavender accents, bows, and a cozy day / moonlight night theme. Share outfit ideas, style notes, and trend picks; readers can browse posts, search for looks, and leave compliments on individual blog entries.

Built to run entirely on [Cloudflare Workers](https://workers.cloudflare.com/) with a [D1](https://developers.cloudflare.com/d1/) database, so it stays fast at the edge and does not need a traditional server.

## Features

- **Accounts** — sign up, log in (by username), and log out
- **Blog posts** — create, edit, and delete your own looks; everyone can read them
- **Home feed** — newest posts first with short previews
- **Search** — find posts by title or body text
- **Comments** — logged-in users can leave compliments on blog post pages only
- **Themes** — toggle between soft day (light) and cozy night (dark); your choice is saved in the browser
- **Security** — hashed passwords, CSRF protection on every form, and safe redirects

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev/) |
| Database | Cloudflare D1 (SQLite) |
| Frontend | HTML, CSS, JavaScript |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` |
| Deploy | Wrangler |

## Run Locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787) in your browser.

## Deploy

```bash
npx wrangler login
npm run deploy
```

## Tests

```bash
npm test
```
