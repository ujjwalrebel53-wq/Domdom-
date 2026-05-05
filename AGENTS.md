# AGENTS.md

## Project Overview

**Rebel AI** — A static vanilla HTML/CSS/JS chatbot web application (no build system, no package manager, no frameworks). The entire app is three files: `index.html`, `main.js`, `style.css`.

## Cursor Cloud specific instructions

### Running the application

Serve the static files with any HTTP server on port 8080:

```bash
python3 -m http.server 8080
```

Then access at `http://localhost:8080/`.

### Key architecture notes

- No package manager, no build step, no test framework, no linter configured.
- All third-party libraries are loaded via CDN (EmailJS, Font Awesome, Google Fonts).
- The frontend expects a backend REST API at the same origin (`/api/*` endpoints) which is **not included** in this repository. Auth, admin panel, and analytics features depend on this missing backend.
- AI chat functionality calls external APIs (Ecomagent, Rebix) with hardcoded API keys in `main.js`.
- `localStorage` is used heavily for client-side state (user sessions, chat history, settings).

### Testing

There are no automated tests, linter, or build commands. Manual testing is done by opening the site in a browser and interacting with the UI.

### Lint / Build / Test

No lint, build, or test scripts exist. The project has no `package.json` or any dependency management.
