# LLMadness

LLMadness is a local-first March Madness arena for foundation models.

It does three things:

1. Takes a bracket config.
2. Runs multiple model agents with tool access to produce full bracket picks, reasoning traces, and tool transcripts as JSON.
3. Serves a Next.js web app that shows each model's bracket, its trace, and a scored leaderboard.

## Stack

- Next.js app router for the web app
- TypeScript for the agent pipeline and scripts
- Plain JSON files for configs, submissions, traces, and scores
- No database

## Project layout

- `app/`: web app routes
- `components/`: UI for leaderboard, bracket board, and traces
- `agents/`: central agent plus model/tool adapters
- `scripts/`: CLI scripts to generate brackets and score them
- `data/configs/`: bracket configs, optionally nested by year
- `data/models/`: model definitions used for a run
- `data/runs/`: generated JSON output per run

## Core architecture

`CentralBracketAgent` is the coordinator. For each model it:

1. Walks the bracket game-by-game in tournament order.
2. Passes the current matchup, prior picks, and tool access to the model adapter.
3. Saves one JSON file per model with picks, confidences, rationale, and reasoning steps.

Current adapters:

- `mock`: deterministic local adapter for demo/testing
- live providers: generic chat-completions style adapter using iterative tool calls for `openai`, `anthropic`, `google-gemini`, `xai`, `moonshot`, `qwen`, `deepseek`, `mimo`, and `zai`

Built-in agent tools:

- `list_teams`
- `get_games`
- `lookup_cbb_ratings`
- `search_web`
- `search_espn_news`
- `fetch_webpage`

The intended production path is to keep the same interfaces and swap in richer tool backends:

- bracket feed once Selection Sunday drops
- team stats API
- injury/news feed
- optional odds or market-implied priors

## Demo data

A sample 2026 run is checked in at `data/runs/demo-2026/` so the UI renders immediately.

- Config: `data/configs/2026/2026-mens-bracket.json`
- Models: `data/models/demo-models.json`
- Live model roster: `data/models/live-models.json`
- Run: `data/runs/demo-2026/`

## Local setup

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## GitHub Pages deploy

The public site is now a static export, so the intended production flow is:

1. Run bracket generation locally.
2. Run scoring locally as results come in.
3. Commit the updated JSON under `data/`.
4. Push to `main`.
5. GitHub Actions builds and deploys the static `out/` export to GitHub Pages.

The Pages workflow lives at `.github/workflows/deploy-pages.yml`.

### Custom domain

The repo is configured to publish with `llmadness.com` via `public/CNAME`.

In GitHub:

1. Open repository `Settings > Pages`.
2. Set `Source` to `GitHub Actions`.
3. After the first deploy, confirm the custom domain is `llmadness.com`.
4. Enable HTTPS once DNS has propagated.

At your DNS provider, point the apex domain to GitHub Pages with these A records:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

For `www`, add a CNAME:

- `www` -> `<your-github-username>.github.io`

If you want `www.llmadness.com` to redirect to `llmadness.com`, configure that in your DNS or registrar settings after Pages is active.

## Generate a run

```bash
npm run generate:brackets -- --config data/configs/2026/2026-mens-bracket.json --models data/models/demo-models.json --run-id demo-2026
```

This writes:

- `data/runs/<run-id>/manifest.json`
- `data/runs/<run-id>/<model-id>.json`

Each submission now includes:

- `picks`
- `reasoning`
- `toolCalls`

## Score a run

```bash
npm run score:brackets -- --run-id demo-2026 --results data/results/2026/2026-actual-results.json
```

This writes:

- `data/runs/<run-id>/leaderboard.json`
- `data/runs/<run-id>/actual-results.json`

## Real tournament workflow for Selection Sunday

When the real bracket is released:

1. Create a bracket config file such as `data/configs/<year>/<year>-mens-bracket.json`.
2. Create a model list in `data/models/<run-name>.json`.
3. Run `generate:brackets`.
4. After results come in, run `score:brackets`.
5. Open the web app and browse the public season route, for example `/2026`.

Recommended environment for live tool use:

- provider API keys/base URLs from `.env.example`
- local ratings files at `data/stats/<year>/torvik.json` and `data/stats/<year>/kenpom.json` are used automatically by `lookup_cbb_ratings`
- `data/models/live-models.json` resolves each API model name from environment variables, so you can swap exact provider model IDs without editing JSON

## Live provider setup

Copy `.env.example` to `.env.local` or `.env` and fill in only the providers you plan to run.

Then validate the configuration:

```bash
npm run validate:live
```

That checks:

- required API key for each configured provider
- provider base URL availability
- environment-backed model ID resolution for every live model entry

To smoke-test one live provider using the exact same env-loading path as `generate:brackets`, run:

```bash
npm run test:provider -- --models data/models/2026/kimi-k2-5.json
```

That is useful when direct `curl` works but the generator still fails, because it verifies the repo's actual `.env.local` resolution and model definition path.

Generate a live run with:

```bash
npm run generate:brackets -- --config data/configs/2026/2026-mens-bracket.json --models data/models/live-models.json --run-id live-demo
```

Notes:

- `MIMO_BASE_URL` is intentionally required because the hosted endpoint can vary.
- The env-backed `LLMADNESS_MODEL_*` variables are the last-mile override layer. The defaults in `.env.example` are starting points, not hard guarantees across providers or account tiers.

## JSON contract notes

The bracket config is graph-based rather than hardcoded to 64 games:

- `teams[]` describes the field
- `games[]` defines each matchup
- each game uses either a team slot or a prior-game winner slot

That means you can load the real NCAA bracket tomorrow without changing the app shape.

## Domain direction

The app metadata is already branded as `LLMadness`. You can point either `LLMadness.com` or `LLMadness.ai` at the deployed Next.js app later without changing the storage model.
