# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview
Rebel AI is a **static, client-side-only** web application (3 files: `index.html`, `main.js`, `style.css`). No build system, no package manager, no backend code in this repo.

### Running the Dev Server
Serve files with any static HTTP server:
```
python3 -m http.server 8080 --directory /workspace
```
Then open `http://localhost:8080` in Chrome.

### Key Gotchas

- **No lint/test/build tooling exists** — there are no `package.json`, linters, test frameworks, or build scripts. Validation is manual (open in browser, check console for JS errors).
- **Admin panel login requires a backend** — The `doLogin()` function in `main.js` first POSTs to `/api/auth/verify`. The `post()` helper catches errors internally (returns `{ok:false}`) instead of throwing, so the local-password fallback in the `catch` block never runs when using a static file server. Admin panel cannot be accessed without either a real backend or patching the auth flow.
- **OTP emails are real** — The EmailJS config has `PUBLIC_KEY: 'WJPN774FeTnl3KAcH'` but the dev-mode check compares against `'WJPN774FeTnl3kAcH'` (note lowercase 'k'). Since these don't match, EmailJS sends **real OTP emails**. The dev-mode toast/console fallback does NOT activate. You must have access to the recipient email to complete registration.
- **AI Chat uses external API** — Chat calls `https://api-rebix.vercel.app/api/gpt-5` (GPT-5 only after latest code update). This is an external Vercel-hosted API not in this repo.
- **Voice Assistant needs Chrome** — Uses Web Speech API (`SpeechRecognition` + `SpeechSynthesisUtterance`), which requires Chrome/Edge with microphone access.
- **All data is in localStorage** — Users, sessions, analytics, chat history, admin password — everything is browser-local. No database.
- **Access Rebel AI modal** — Clicking "Access Rebel Ai" button may skip the picker modal (Chat/Voice options) and go directly to auth if no user is logged in. The picker shows only after authentication.
