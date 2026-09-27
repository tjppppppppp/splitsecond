# SplitSecond

A structured decision-making tool. Define options, weight criteria to 100%,
score each option 1-10 with written reasoning, and get a deterministic
weighted result. Separately, deterministic sensitivity analysis shows how
robust the result is to changes in weights or scores. Separately again, a
"Challenge My Decision" feature critiques the *reasoning* behind your scores
&mdash; missing criteria, unsupported assumptions, double-counted factors,
uncertainty, and cognitive biases.

**No external AI service, no API keys, $0 to run.** "Challenge My Decision"
is a fully local, deterministic, rule-based audit engine
(`src/lib/audit/auditEngine.ts`) &mdash; it runs entirely in the browser, makes
no network calls, and requires no account, key, or paid service of any kind.

**Architecture rule:** nothing outside the scoring/sensitivity engine ever
calculates or alters the deterministic score. All scoring and sensitivity
analysis is plain, unit-tested TypeScript (`src/lib/scoring.ts`,
`src/lib/sensitivity.ts`). The audit layer (`src/lib/audit/`) only ever reads
the already-computed result as context and returns a response type
(`AuditResult`) that has no numeric score/weight/ranking/confidence field
anywhere in it &mdash; enforced by TypeScript and proven by a dedicated test
that walks a real computed result and asserts no numeric leaf exists.

## Local development

```
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest — full engine + component test suite
npm run build      # production build (tsc -b && vite build)
npm run preview    # serve the production build locally
```

## Data

Decisions are stored in the browser's `localStorage`
(`splitsecond.decisions.v1`) &mdash; nothing is ever sent anywhere over the
network. Use the Export/Import JSON buttons on the decision list as a manual
backup, since localStorage is per-browser and not synced across devices.

## Deployment

Static site only &mdash; no server component, no functions, no environment
variables. See `netlify.toml` (build command + SPA fallback redirect only).

**Continuous deployment:** this repo is linked to Netlify via a read-only
deploy key (Settings &gt; Deploy keys on GitHub) rather than the GitHub App
integration. Every push to `main` triggers an automatic production build and
deploy &mdash; no manual `netlify deploy` step needed.
