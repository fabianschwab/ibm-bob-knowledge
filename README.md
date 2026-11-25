# Bob Assets

A collection of material for presenting, demonstrating and installing [IBM Bob](https://www.ibm.com/products/ibm-bob), IBM's AI SDLC partner. It is used for customer talks, workshops and hands-on demos.

| Folder | What it is |
|---|---|
| [`presentation/`](presentation/) | HTML slide deck introducing Bob |
| [`on-prem-install/`](on-prem-install/) | Docs and architecture for an air-gapped, self-hosted Bob install on OpenShift |
| [`bob-hooks-example/`](bob-hooks-example/) | Live demo of Bob lifecycle hooks with a dashboard |

The root also holds two PDFs (`Bob Roadmap - 2026.PDF`, `Bob TechZone Environment.pdf`) and a [`.bob/`](.bob/) folder with the project's own Bob configuration (custom modes, MCP, hooks).

## Presentation

[`presentation/`](presentation/) is a static, browser-based slide deck (11 slides, plain HTML/CSS with [`nav.js`](presentation/nav.js) for arrow navigation). Open [`01-welcome.html`](presentation/01-welcome.html) to start.

Slides cover:

1. Welcome
2. What you can do with Bob
3. Key features (modes, skills, subagents, code reviews, auto-approve, and more)
4. Customizing Bob (rules, AGENTS.md, custom modes, MCP servers, hooks, workflows)
5. Bob across the SDLC
6. Shift-left security
7. Context window management (risks and hygiene)
8. Governance
9. Tool comparison
10. On-prem architecture
11. Thanks

Main slides link to `*-details/` subfolders for deeper dives. Some content is in German (for example [`vergleich.md`](presentation/vergleich.md) and the German architecture SVG).

## On-prem installation

[`on-prem-install/`](on-prem-install/) describes how to run Bob fully self-hosted on customer-managed OpenShift, including air-gapped setups.

- [`index.html`](on-prem-install/index.html) and [`architecture.html`](on-prem-install/architecture.html) give an overview and the architecture picture.
- [`docs/bob-onprem-step-by-step-guide.md`](on-prem-install/docs/bob-onprem-step-by-step-guide.md) walks through the air-gapped install: mirror images to a private registry, apply the cluster resources, deploy the Bob operator and instance, configure the Model Gateway, manage users in Keycloak, and set up Bob IDE and Bob Shell clients.
- [`docs/requirements.md`](on-prem-install/docs/requirements.md) and [`docs/minimal.md`](on-prem-install/docs/minimal.md) cover sizing and minimum requirements (in German): a 9-node OpenShift reference cluster, storage and network needs, and the models.

Bob does not ship or run the LLMs. You must provide an OpenAI-compatible inference endpoint (for example vLLM or OpenShift AI).

## Bob hooks example

[`bob-hooks-example/`](bob-hooks-example/) shows how Bob lifecycle hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `PostCompact`, `Stop`) can be used to watch a Bob session live.

- [`hooks-example/`](bob-hooks-example/hooks-example/) is a small Express todo app. Its `.bob/` config runs a tiny script that forwards every hook event to the dashboard.
- [`hooks-dashboard/`](bob-hooks-example/hooks-dashboard/) is a SvelteKit app that receives the events and shows each session as a live timeline.

Quick start (two terminals):

```bash
# Terminal 1: dashboard on http://localhost:5173
cd bob-hooks-example/hooks-dashboard
npm install && npm run dev

# Terminal 2: todo app on http://localhost:3000
cd bob-hooks-example/hooks-example
npm install && npm start
```

Then open `hooks-example/` in Bob and start a chat. Events appear in the dashboard. See [`bob-hooks-example/README.md`](bob-hooks-example/README.md) for details, including how hooks can block tool calls or inject context.
