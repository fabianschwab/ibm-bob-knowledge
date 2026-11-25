# Bob hooks dashboard

A live dashboard for IBM Bob hook events. Your hooks POST JSON here; the dashboard groups
events by `session_id` and renders each session as a timeline.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run seed         # optional: load sample sessions
```

## Sending events

POST one JSON object (or an array of them) to `/api/hooks`. This is exactly the payload Bob gives a hook, so an
`http` handler can point straight at it:

```json
{
	"hooks": {
		"PostToolUse": [{ "hooks": [{ "type": "http", "url": "https://your-host/api/hooks" }] }]
	}
}
```

Bob's HTTP handlers require **HTTPS** with a certificate Node trusts, so for local use either put a tunnel/proxy in
front of the dev server or have a `command` hook `curl` the payload from stdin:

```sh
curl -s -X POST http://localhost:5173/api/hooks -H 'content-type: application/json' -d @-
```

Only `session_id` and `hook_event_name` are used for grouping; everything else is stored and shown verbatim in the
raw payload view. The dashboard stamps each event with `id` and `received_at` on arrival (the hook payloads carry no
timestamp, so durations are arrival-time deltas and include network latency).

## What it shows

- **Sessions** grouped by `session_id`, with status: active (event in the last 2 min), idle, or completed (`Stop` seen).
- **Timeline** per session. `PreToolUse` and `PostToolUse` are joined on `tool_use_id` into one tool call with a
  duration; a call with no `PostToolUse` yet shows as _running_ (or never finished, if it errored).
- Event mix bar, counts, expandable tool response and raw JSON.
- Live updates over Server-Sent Events (`/api/stream`).

## Endpoints

| Method   | Path          | Purpose                           |
| -------- | ------------- | --------------------------------- |
| `POST`   | `/api/hooks`  | Ingest one event or an array      |
| `GET`    | `/api/hooks`  | All stored events                 |
| `DELETE` | `/api/hooks`  | Clear everything                  |
| `GET`    | `/api/stream` | SSE feed of newly ingested events |

## Storage and limits

Events are appended to `data/events.jsonl` (override with `HOOKS_DATA_FILE`) and the newest 5000 are kept in memory.
There is **no authentication** on the ingest or delete endpoints, and SSE state lives in one process, so run a single
instance and keep it off the public internet. Payloads can contain prompts and tool output, so treat the data file as
sensitive.
