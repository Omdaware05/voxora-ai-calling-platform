# Voxora Frontend — Enterprise AI Voice Calling Platform

React 19 + TypeScript (strict) + Vite + Tailwind CSS v4 + React Router + TanStack Query.

## Prerequisites

- Node.js 20+ and npm
- The Voxora backend running and reachable (all JSON under `/api/v1`)

## Setup

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

Open http://localhost:5173 and sign in (demo: `admin@voxora.demo` / `demo1234`).

## Configuration

| Variable        | Default | Description                          |
| --------------- | ------- | ------------------------------------ |
| `VITE_API_URL`  | `/api`  | Backend base URL; API lives under `/api/v1`. WebSocket URLs are derived from it (`http` → `ws`). |

Auth: login stores the JWT in `localStorage` (`voxora_token`); an axios
interceptor attaches `Authorization: Bearer <token>` and redirects to `/login`
on 401.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm test` — run the vitest suite
- `npm run typecheck` — `tsc --noEmit`

## Project structure

- `src/api/` — axios client + typed modules per domain (`auth`, `agents`,
  `calls`, `campaigns`, `contacts`, `leads`, `followups`, `questionnaires`,
  `businesses`, `telephony`, `models`, `analytics`, `users`, `dograh`)
- `src/auth/` — `AuthContext` (login/logout/me, role helpers) + `ProtectedRoute`
- `src/theme/` — dark/light/system theme via `.dark` class, persisted
- `src/components/ui/` — hand-rolled shadcn-style primitives (button, dialog,
  table, tabs, …)
- `src/components/common/` — toasts, stat cards, status badges, error/empty
  states, audio player, action menus
- `src/pages/` — one component per route (see `src/App.tsx`)
- `src/__tests__/` — vitest suites (login validation, router, agent schema)

## Notes

- No hardcoded API URLs; everything goes through `VITE_API_URL`.
- Pages are lazy-loaded route chunks.
- Twilio/Plivo provider cards and Security → password/API-key sections are
  intentionally non-interactive until the backend exposes those endpoints —
  they render as clearly-labeled notices, not dead buttons.
