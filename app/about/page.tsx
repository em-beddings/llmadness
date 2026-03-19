import Link from "next/link";
import {
  LIVE_TOOL_NAMES,
  renderSystemPromptTemplate,
  renderUserPromptTemplate,
} from "@/lib/methodology";

const SYSTEM_PROMPT = renderSystemPromptTemplate();
const USER_PROMPT = renderUserPromptTemplate();

const SCORING_ROWS = [
  ["First Four", "0"],
  ["Round of 64", "1"],
  ["Round of 32", "2"],
  ["Sweet 16", "4"],
  ["Elite 8", "8"],
  ["Final Four", "16"],
  ["Championship", "32"],
] as const;

export default function AboutPage() {
  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">About</p>
          <h1>Methodology</h1>
          <p>
            LLMadness is a game-by-game tournament arena where foundation models
            make March Madness picks using the same bracket, the same scoring
            rules, and the same tool surface.
          </p>
        </div>
        <Link className="back-link" href="/2026">
          Back to leaderboard
        </Link>
      </section>

      <section className="about-grid">
        <article className="panel about-card">
          <h2>How the tournament works</h2>
          <ul>
            <li>
              Each model predicts one game at a time, not the whole bracket in
              one shot.
            </li>
            <li>
              Earlier picks become committed bracket state for later rounds.
            </li>
            <li>
              Every game stores the pick, confidence, rationale, reasoning step,
              and trace.
            </li>
          </ul>
        </article>

        <article className="panel about-card">
          <h2>Tooling</h2>
          <p>
            The live agent can inspect bracket structure, ratings, and the open
            web.
          </p>
          <ul>
            {LIVE_TOOL_NAMES.map((tool) => (
              <li key={tool}>
                <code>{tool}</code>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel about-card">
          <h2>Scoring</h2>
          <p>
            Leaderboard points are round-weighted and only awarded for correct
            picks.
          </p>
          <div className="about-score-grid">
            {SCORING_ROWS.map(([round, points]) => (
              <div className="about-score-row" key={round}>
                <span>{round}</span>
                <strong>{points}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel about-card">
          <h2>What gets stored</h2>
          <ul>
            <li>Winner selection for each game</li>
            <li>Confidence score</li>
            <li>Short paragraph rationale</li>
            <li>Structured reasoning step and evidence</li>
            <li>Full per-game model trace</li>
            <li>Manual total run cost, if supplied</li>
          </ul>
        </article>
      </section>

      <section className="panel about-prompt-card">
        <div className="section-header">
          <div>
            <h2>System prompt</h2>
            <p>
              The runtime adds live game context, bracket metadata, and the
              tool-round budget to the system prompt for every prediction.
            </p>
          </div>
        </div>
        <pre className="code-block about-code-block">{SYSTEM_PROMPT}</pre>
      </section>

      <section className="panel about-prompt-card">
        <div className="section-header">
          <div>
            <h2>User prompt</h2>
            <p>
              The user prompt contains the resolved matchup, recent committed
              picks, and the exact JSON payload shape the model is expected to
              use.
            </p>
          </div>
        </div>
        <pre className="code-block about-code-block">{USER_PROMPT}</pre>
      </section>
    </main>
  );
}
