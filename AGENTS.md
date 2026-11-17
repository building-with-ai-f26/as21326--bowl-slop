# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** Mount Neverest, a browser tower-climbing game with icy, momentum-based jumps and four parody heroes, plus its Product Page.
- **Primary user & core workflow:** NYU students with 5–10 spare minutes: open link → pick a hero → climb (dodge villain beams, grab power-ups, ride moving and slanted platforms) → fall → read a one-line AI coach tip → retry. Full PRD in `docs/index.html`.
- **Tech stack:** Game = plain JavaScript + Canvas, no build step: `docs/game.html` (physics, levels, enemies, power-ups, menus, keyboard + touch/tilt controls), `docs/characters.js` (hero perks and villain art), `docs/audio.js` (Web Audio music and sound effects, no files). Coach = a small dependency-free Node server (`server.js`) that serves `docs/` and exposes `POST /api/coach`, which calls Claude Haiku through the Anthropic API. Analytics = PostHog (public `phc_` project key in the HTML; it can only send events). Hosted on GitHub Pages from `/docs` (static, so the coach only works locally).
- **Structure:** `docs/index.html` Product Page + living PRD + build log · `docs/game.html`, `characters.js`, `audio.js` the game · `server.js` local server + AI call · `journal/` optional notes · `.env` (git-ignored) holds the Anthropic API key.
- **Rule for content:** original parody characters only. No licensed characters, art or promo material in this public repo.

## 2. Commands
- **Install dependencies:** none (needs Node 20.12+)
- **Set up secrets:** `cp .env.example .env`, then put your Anthropic API key in `.env`
- **Run locally:** `node server.js`, then open http://localhost:8123 (the game still runs without a key; the coach line just won't appear). Testing shortcut: add `?floor=60` to start at floor 60 (villains from 50, slanted ramps from 100)
- **Run deterministic tests:** none yet; Build 1 was checked by hand and with in-browser bot play-tests
- **Run model evals:** none yet (Build 4). Manual check: finish a run and confirm a coach line appears and `coach_received` shows in PostHog

## 3. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.
