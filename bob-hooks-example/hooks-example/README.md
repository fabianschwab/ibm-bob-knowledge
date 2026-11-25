# hooks-example

A small todo app built to demonstrate Bob lifecycle hooks. The app itself is a plain Express server with an in-memory todo list and a single-page front end. The interesting part is the `.bob/` directory, which forwards every Bob hook event to a local HTTP endpoint.

## Requirements

- Node.js (the repo uses `fetch` and top-level `await`, so use a current LTS release)
- npm

## Running the app

```bash
npm install
npm start
```

The server listens on port `3000` by default. Set `PORT` to change it:

```bash
PORT=4000 npm start
```

Then open <http://localhost:3000>.

## How the app works

[`server.js`](server.js) serves two things:

- The static front end from [`public/`](public/index.html)
- A JSON API under `/api/todos`

Todos live in a plain array in the server process, so restarting the server clears them. IDs come from an incrementing counter and are not reused.

### API

| Method | Path             | Body                                  | Success response       | Errors                        |
| ------ | ---------------- | ------------------------------------- | ---------------------- | ----------------------------- |
| GET    | `/api/todos`     | none                                  | `200`, array of todos  | none                          |
| GET    | `/api/todos/:id` | none                                  | `200`, the todo        | `404` if the ID doesn't exist |
| POST   | `/api/todos`     | `{ "title": "..." }`                  | `201`, the new todo    | `400` if `title` is missing   |
| PUT    | `/api/todos/:id` | `{ "title"?: "...", "completed"?: bool }` | `200`, the updated todo | `404` if the ID doesn't exist |
| DELETE | `/api/todos/:id` | none                                  | `200`, the deleted todo | `404` if the ID doesn't exist |

A todo looks like this:

```json
{ "id": 1, "title": "Write the README", "completed": false }
```

Example:

```bash
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write the README"}'

curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

Validation is minimal. `PUT` only updates the fields you send and coerces `completed` to a boolean, but it doesn't check `title`, so an empty string is accepted. `POST` rejects a missing or empty `title` but doesn't check its type.

### Front end

[`public/index.html`](public/index.html) is a single file with inline CSS and JavaScript. It lets you add a todo, tick it off, and delete it. Titles are HTML-escaped before rendering. After every change it reloads the whole list from the API rather than updating the page locally.

Ticking a todo fetches the full list to find the current `completed` value, then sends a `PUT` with the opposite value. That's an extra request you could avoid by reading the state from the checkbox, but it works fine at this scale.

## Bob hooks

Hooks are configured in [`.bob/settings.json`](.bob/settings.json). The same command runs for each of these events:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PreCompact`
- `PostCompact`
- `Stop`

Every entry runs `node .bob/hooks/forward-hook.mjs`. Run Bob from the repo root, because the command path is relative.

[`.bob/hooks/forward-hook.mjs`](.bob/hooks/forward-hook.mjs) reads whatever Bob writes to stdin and POSTs it unchanged to `http://localhost:5173/api/hooks` as JSON. It doesn't parse or modify the payload.

### The receiving server isn't in this repo

Nothing here listens on port `5173`. The Express app uses port `3000` and has no `/api/hooks` route. To see the hook events you need to run your own receiver on `http://localhost:5173/api/hooks`, for example a dashboard that displays them.

If nothing is listening, the hook fails silently. The script catches the `fetch` error and exits normally, so Bob carries on as usual. This is deliberate ("fail open"), but it also means a misconfigured receiver won't produce any visible error. If events aren't arriving, check the receiver is running and on the right port first.

The script only sends data. It never returns a decision to Bob, so it can't block or alter a tool call.

## Project layout

```
.
├── .bob/
│   ├── settings.json          Hook configuration
│   └── hooks/
│       └── forward-hook.mjs   Forwards hook payloads to localhost:5173
├── public/
│   └── index.html             Front end
├── server.js                  Express server and todo API
└── package.json
```

## Known limits

- Data is in memory only, with no persistence.
- There are no automated tests. `npm test` just exits with an error.
- There is no authentication, so don't expose this beyond your own machine.
