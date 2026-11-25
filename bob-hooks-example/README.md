# Bob Hooks — Live Demo

This repo is a working demonstration of [IBM Bob](https://www.ibm.com/products/ibm-bob) lifecycle hooks. The idea is simple: every time Bob does something — starts a session, receives a prompt, calls a tool, compacts its context, or stops — it fires a hook. Here we intercept all of those events and stream them to a live dashboard so you can watch a conversation unfold in real time.

There are two packages:

| Directory | What it is |
|---|---|
| [`hooks-example/`](hooks-example/) | A small Express todo app. Its `.bob/` directory is wired up to forward every hook event to the dashboard. Open this project in Bob to generate hook traffic. |
| [`hooks-dashboard/`](hooks-dashboard/) | A SvelteKit app that receives the hook payloads, groups them by session, and renders each session as a timeline. |

## How it fits together

```
Bob (running inside hooks-example/)
  │
  │  fires hook → runs node .bob/hooks/forward-hook.mjs
  │
  ▼
POST http://localhost:5173/api/hooks
  │
  ▼
hooks-dashboard (SvelteKit dev server)
  │  stores event, pushes to SSE feed
  ▼
Browser dashboard (live timeline view)
```

Bob's hook system runs a shell command for each event, passing the payload on stdin. The forward hook reads stdin and POSTs the raw JSON to the dashboard. That's the entire integration — about 14 lines of JavaScript.

## Getting started

You need two terminals.

**Terminal 1 — start the dashboard:**

```bash
cd hooks-dashboard
npm install
npm run dev          # http://localhost:5173
```

Optionally seed it with some sample events so you can see what the UI looks like before running Bob:

```bash
npm run seed
```

**Terminal 2 — start the todo app (optional, but it gives Bob something to work on):**

```bash
cd hooks-example
npm install
npm start            # http://localhost:3000
```

Then open `hooks-example/` in Bob and start a conversation. Every event Bob fires will appear in the dashboard at `http://localhost:5173`.

## What the hooks capture

Seven event types are registered in [`hooks-example/.bob/settings.json`](hooks-example/.bob/settings.json):

| Event | When it fires |
|---|---|
| `SessionStart` | Bob loads the project for the first time |
| `UserPromptSubmit` | You send a message |
| `PreToolUse` | Just before Bob calls a tool |
| `PostToolUse` | After the tool returns |
| `PreCompact` | Before Bob compacts its context window |
| `PostCompact` | After compaction completes |
| `Stop` | Bob finishes its response |

All seven use the same `command` hook pointing at [`forward-hook.mjs`](hooks-example/.bob/hooks/forward-hook.mjs). The `matcher` field on `PreToolUse` and `PostToolUse` is set to `.*`, so every tool fires them regardless of name.

## The forward hook

[`hooks-example/.bob/hooks/forward-hook.mjs`](hooks-example/.bob/hooks/forward-hook.mjs) is deliberately minimal:

```js
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
}

try {
  await fetch("http://localhost:5173/api/hooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
} catch (_) {
  // Fail open silently if local server is down
}
```

It doesn't parse, filter, or modify anything. If the dashboard isn't running, the `fetch` throws and Bob carries on as normal. Hooks that fail silently are described as "fail open" in the Bob docs — useful for observability tooling where you don't want a broken receiver to block the agent.

## What the dashboard shows

- Sessions grouped by `session_id`, with a status indicator (active, idle, or completed).
- A timeline per session. `PreToolUse` and `PostToolUse` pairs are joined on `tool_use_id` so you see each tool call as a single entry with a duration.
- The raw JSON payload for any event, expandable inline.
- Live updates over Server-Sent Events — no polling.

## Going further

This demo only observes. Hooks can also influence Bob's behaviour:

- A `command` hook that exits non-zero on `PreToolUse` will **block** the tool call.
- A `command` hook can write to stdout on certain events to inject additional context back to Bob.
- The `http` hook type posts directly to an HTTPS endpoint without needing a shell script intermediary (though you'd need a trusted certificate for local use).

See the [Bob hooks documentation](https://www.ibm.com/docs/en/bob) for the full event schema and the decision-making rules.

## ADDENDUM: Decision models at hook points (Jev / System One)

The current forward hook is a passive observer — it forwards everything and makes no decisions. A natural extension is to route hook payloads through a decision model before Bob acts on them. [Jev](https://typesafe.ai), TypeSafe AI's "System One" model, is a strong candidate for this.

The core idea behind Jev is that not everything needs a generative LLM. For the large number of small, structured judgements an agent makes — is this action safe? which tool should handle this? does this need a human? — you want something that takes application state and returns a **typed, probabilistic value** rather than a block of text to be parsed. TypeSafe borrows the framing from Daniel Kahneman: the LLM is System Two (deliberate reasoning), Jev is System One (fast, reflexive judgement).

Jev exposes three primitives:

| Primitive | What it does | Example |
|---|---|---|
| **Choice** | Select one option from a predefined set | Which tool should handle this request? |
| **Score** | Evaluate against an ordered scale | How destructive is this shell command? (0–2) |
| **Noul** | Return a calibrated probability for a proposition | "This command could irreversibly alter user data." → 0.97 |

The outputs are machine-consumable directly. No JSON parsing, no schema validation, no retry loop — just a typed value your code can branch on.

### Where this meets Bob hooks

`PreToolUse` is the obvious insertion point. Before Bob executes a tool call, a hook can submit the proposed action to Jev and receive structured judgements:

```
PreToolUse hook fires
        │
        ▼
  state: { user_request, conversation_context, proposed_tool, proposed_args }

  questions:
    destructive:  "Could this irreversibly alter or delete data?"       → Noul
    aligned:      "Is this action necessary to fulfil the request?"     → Noul
    risk:         score on scale 0 (benign) → 2 (irreversible)         → Score
        │
        ▼
         Jev
        │
        ▼
  { destructive: 0.94, aligned: 0.31, risk: 1.8 }
        │
        ├── risk > 1.5  →  hook exits non-zero, Bob is blocked
        ├── risk 0.5–1.5 →  hook injects a warning into Bob's context
        └── risk < 0.5  →  hook exits 0, Bob proceeds
```

The policy logic — the thresholds and what happens at each band — lives in normal software. Jev provides the semantic judgement; your code determines what to do with it. That separation is the architectural point.

Other hook events that become interesting with a decision model:

- **`UserPromptSubmit`** — intent routing. Classify the request before the LLM sees it to choose a mode, skill, or model tier.
- **`PreToolUse` + `PostToolUse`** — tool-call risk gating and result validation.
- **`Stop`** — output quality scoring before the response is shown.

### A note on calibration

Jev is trained for *calibrated* decisions (TypeSafe calls the approach RLCD — Reinforcement Learning for Calibrated Decisions). Calibration means the probabilities reflect genuine uncertainty: a 0.9 score across a population of similar predictions should be right about 90% of the time. That's what makes the threshold pattern above workable rather than arbitrary.

Worth being explicit though: calibrated ≠ infallible. Typed output means Jev can't hallucinate outside your schema, but it can still return a confidently wrong answer. A `risk: 0.1` score on a genuinely dangerous command is still possible. Treat the probabilities as a well-calibrated signal, not a guarantee.

### Deployment consideration

As of late 2025, Jev is available through TypeSafe AI's hosted API with weights not publicly disclosed. For air-gapped, sovereign, or public-sector deployments that require on-premises inference, that's a hard architectural constraint to resolve before committing to this approach.

## Requirements

- Node.js 18+ (the forward hook uses native `fetch` and top-level `await`)
- npm
