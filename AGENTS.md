# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** Slip Up!, a browser tower-climbing game with icy, momentum-based jumps and parody characters, plus its Product Page.
- **Primary user & core workflow:** [See the living PRD in `docs/index.html`]
- **Tech stack:** One static HTML file with plain JavaScript and the Canvas API (`docs/game.html`). No build step, no libraries, no backend, no API keys. Hosted on GitHub Pages from `/docs`.

## 2. Commands
- **Install dependencies:** none
- **Run locally:** open `docs/game.html` in a browser (double-click it, or `open docs/game.html` on macOS)
- **Run deterministic tests:** none yet; Build 1 was checked by hand and with in-browser bot play-tests
- **Run model evals:** n/a (no AI model in the product)

## 3. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.
