# 🎟️ GitHub Actions / Telegram ticket-monitor bot

I got tired of refreshing a ticket page every few seconds like a clown, so I made this.

It checks a page every 10 minutes and pings you on Telegram if something like “available” shows up. That’s the whole deal.

---

## How it works

GitHub Actions runs it every 10 mins (9AM–11PM IST).
It opens the page properly (so JS-heavy sites work), scans it, and:

* finds nothing → does nothing
* finds tickets → sends “GO. NOW.” on Telegram

---

## Setup

1. Fork this repo

2. Add these in **Settings → Secrets → Actions**

| Name         | Value                        |
| ------------ | ---------------------------- |
| `BOT_TOKEN`  | from @BotFather              |
| `CHAT_ID`    | from @userinfobot            |
| `TARGET_URL` | the page you keep refreshing |

3. Go to **Actions → Ticket Monitor → Run workflow** once

That’s it. It’ll keep running.

---

## Run locally (optional)

```bash
npm install
cp .env.example .env
node monitor.js
```

---

## Things to know

* GitHub might pause it after ~60 days → star your repo or just rerun it
* It only alerts once per run
* If you miss it… yeah, that’s on you

---

Made because I didn’t trust myself to “check occasionally”.
