# Retro Board

An anonymous team retrospective board — an original take on the online-retro concept,
built with Next.js (App Router), TypeScript, Tailwind CSS, and shadcn-style UI.

## How a session runs

The host (one of the members) creates a session. Every member joins under an
anonymous alias — no names are attached to anything, start to finish.

Each topic (e.g. *Went well*, *Could improve*, *Try next*) runs as its own
guided round:

1. **Write** — a timer runs while everyone adds cards. Cards stay blurred so
   nobody gets anchored by others' ideas.
2. **Group** — cards are clustered into themes automatically; the host can
   rename themes, create new ones, or drag cards between groups to fix the
   auto-grouping.
3. **Vote** — members vote per group with vote counts hidden. Totals are
   unveiled once everyone finishes voting, and themes rank by votes.

The session ends with a results review where top themes become assigned,
dated action items. Boards persist in the browser (localStorage) and can be
downloaded/reopened as JSON.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Checks

```bash
pnpm exec tsc --noEmit
pnpm build
```
