# SplitSecond

A structured decision-making tool. Define options, weight criteria to 100%,
score each option 1-10 with written reasoning, and get a deterministic
weighted result. Separately, deterministic sensitivity analysis shows how
robust the result is to changes in weights or scores. Separately again, an AI
"Challenge My Decision" feature critiques the *reasoning* behind your scores —
missing criteria, unsupported assumptions, double-counted factors,
uncertainty, and cognitive biases.

**Architecture rule:** AI never calculates or alters the deterministic score.
All scoring and sensitivity analysis is plain, unit-tested TypeScript
(`src/lib/scoring.ts`, `src/lib/sensitivity.ts`). The AI layer
(`src/lib/ai/`, `netlify/functions/challenge.ts`) only ever reads the
already-computed result as context and returns a response type
(`ChallengeResult`) that has no numeric score/weight/ranking/confidence field
anywhere in it — enforced both by TypeScript and by a strict zod schema on
the server.

## Local development

```
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest — full engine + component + function test suite
npm run build      # production build (tsc -b && vite build)
npm run preview    # serve the production build locally
```

To exercise the AI panel locally, create a `.env` (gitignored) from
`.env.example` and set your own `ANTHROPIC_API_KEY`, then run `netlify dev`
instead of `npm run dev` so the Netlify Function is served alongside the app.

## Data

Decisions are stored in the browser's `localStorage`
(`splitsecond.decisions.v1`) — nothing is sent to a server except the
read-only context for an AI challenge request. Use the Export/Import JSON
buttons on the decision list as a manual backup, since localStorage is
per-browser and not synced across devices.

## Deployment

Static site + one Netlify Function (`netlify/functions/challenge.ts`), see
`netlify.toml`. The function requires `ANTHROPIC_API_KEY` set as an
environment variable in the Netlify dashboard (Site settings > Environment
variables, scoped to Functions) — without it, the AI panel reports a clean
"not configured" state rather than failing silently; the deterministic
scoring and sensitivity views work fully without it.
