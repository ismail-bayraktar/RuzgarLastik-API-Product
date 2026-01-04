# Plan: Documentation & Architecture Alignment

## Phase 1: Architecture & Context Updates
- [x] Task: Update `01-claude-context.md`
    - **Goal:** Remove references to "Hono Backend (apps/server)" as a separate entity. Describe "Next.js API Routes (Unified Backend)". Update tech stack description.
- [x] Task: Update `02-prd-detailed.md`
    - **Goal:** Update architecture diagrams and component descriptions to reflect the unified structure.
- [x] Task: Update `04-flows-architecture.md`
    - **Goal:** Redraw "End-to-End Sync Flow" diagram to show Next.js API Routes instead of "Hono Backend". Update Vercel deployment flows.

## Phase 2: Configuration & Setup Updates
- [x] Task: Update `05-env-configuration.md`
    - **Goal:** Merge backend and frontend `.env` sections. Explain that there is only one `.env` (or `.env.local` for Next.js) in development and Vercel Env Vars in production. Remove `PORT` config if not relevant for Vercel.
- [x] Task: Update `06-environment-setup.md`
    - **Goal:** Simplify setup instructions. `bun dev` starts the single Next.js app. No need to start backend separately.
- [x] Task: Update `07-troubleshooting.md`
    - **Goal:** Update error scenarios relevant to Next.js (e.g., build errors, serverless timeouts) and remove "Port 5000 in use" if strictly using Next.js default port.

## Phase 3: Final Verification
- [x] Task: Review all docs for consistency.
- [x] Task: Ensure `CLAUDE.md` (if exists) is up to date with new commands.
