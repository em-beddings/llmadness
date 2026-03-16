"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AdminConfigOption, AdminModelOption, AdminRunJob } from "@/lib/admin";

const ROUND_OPTIONS = [
  "First Four",
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship"
] as const;

export function AdminRunner({
  configs,
  models
}: {
  configs: AdminConfigOption[];
  models: AdminModelOption[];
}) {
  const [selectedConfigFile, setSelectedConfigFile] = useState(configs[0]?.file ?? "");
  const [selectedModelKey, setSelectedModelKey] = useState(models[0]?.key ?? "");
  const [slotATeamId, setSlotATeamId] = useState(configs[0]?.teams[0]?.id ?? "");
  const [slotBTeamId, setSlotBTeamId] = useState(configs[0]?.teams[1]?.id ?? configs[0]?.teams[0]?.id ?? "");
  const [round, setRound] = useState<(typeof ROUND_OPTIONS)[number]>("Championship");
  const [label, setLabel] = useState("");
  const [job, setJob] = useState<AdminRunJob | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConfig = useMemo(
    () => configs.find((config) => config.file === selectedConfigFile) ?? configs[0] ?? null,
    [configs, selectedConfigFile]
  );

  useEffect(() => {
    if (!selectedConfig) {
      return;
    }

    setSlotATeamId(selectedConfig.teams[0]?.id ?? "");
    setSlotBTeamId(selectedConfig.teams[1]?.id ?? selectedConfig.teams[0]?.id ?? "");
  }, [selectedConfig]);

  useEffect(() => {
    if (!job || !["pending", "running"].includes(job.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/admin/run/${job.id}`, { cache: "no-store" });
      const payload = (await response.json()) as AdminRunJob | { error: string };

      if (!response.ok || "error" in payload) {
        setError(typeof payload.error === "string" ? payload.error : "Unable to refresh admin job.");
        setPending(false);
        window.clearInterval(interval);
        return;
      }

      setJob(payload);
      if (!["pending", "running"].includes(payload.status)) {
        setPending(false);
        window.clearInterval(interval);
      }
    }, 800);

    return () => window.clearInterval(interval);
  }, [job]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setJob(null);

    const response = await fetch("/api/admin/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        configFile: selectedConfigFile,
        modelKey: selectedModelKey,
        round,
        slotATeamId,
        slotBTeamId,
        label
      })
    });

    const payload = (await response.json()) as AdminRunJob | { error: string };
    if (!response.ok || "error" in payload) {
      setError(typeof payload.error === "string" ? payload.error : "Unable to start admin run.");
      setPending(false);
      return;
    }

    setJob(payload);
  }

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <h1>Admin</h1>
          <p>Run a single matchup through any configured model to inspect the pick, rationale, and tool usage before a full bracket run.</p>
        </div>
      </section>

      <div className="admin-grid">
        <section className="panel admin-form-panel">
          <div className="section-header">
            <div>
              <h2>Single Game Runner</h2>
            </div>
            <p>Uses the same adapter and tool stack as production runs.</p>
          </div>

          <form className="admin-form" onSubmit={onSubmit}>
            <label className="admin-field">
              <span>Bracket config</span>
              <select value={selectedConfigFile} onChange={(event) => setSelectedConfigFile(event.target.value)}>
                {configs.map((config) => (
                  <option key={config.file} value={config.file}>
                    {config.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Model</span>
              <select value={selectedModelKey} onChange={(event) => setSelectedModelKey(event.target.value)}>
                {models.map((model) => (
                  <option key={model.key} value={model.key}>
                    {model.label} [{model.provider}]
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-field-grid">
              <label className="admin-field">
                <span>Team A</span>
                <select value={slotATeamId} onChange={(event) => setSlotATeamId(event.target.value)}>
                  {selectedConfig?.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      ({team.seed}) {team.name} [{team.region}]
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Team B</span>
                <select value={slotBTeamId} onChange={(event) => setSlotBTeamId(event.target.value)}>
                  {selectedConfig?.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      ({team.seed}) {team.name} [{team.region}]
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-field-grid">
              <label className="admin-field">
                <span>Round</span>
                <select value={round} onChange={(event) => setRound(event.target.value as (typeof ROUND_OPTIONS)[number])}>
                  {ROUND_OPTIONS.map((roundOption) => (
                    <option key={roundOption} value={roundOption}>
                      {roundOption}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Label</span>
                <input
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Optional custom matchup label"
                  type="text"
                  value={label}
                />
              </label>
            </div>

            <button className="admin-submit" disabled={pending} type="submit">
              {pending ? "Running..." : "Run matchup"}
            </button>
          </form>

          {error ? <p className="admin-error">{error}</p> : null}
        </section>

        <section className="panel admin-result-panel">
          <div className="section-header">
            <div>
              <h2>Result</h2>
            </div>
          </div>

          {job ? (
            <div className="admin-result-stack">
              <div className="leader-bottomline leader-bottomline-nowrap">
                <span>Status</span>
                <strong>{job.status}</strong>
              </div>

              <section className="modal-section">
                <h3>Trace</h3>
                <div className="admin-trace-list">
                  {job.events.map((entry) => (
                    <div className="admin-trace-item" key={entry.id}>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <strong>{entry.message}</strong>
                    </div>
                  ))}
                </div>
              </section>

              {job.result ? (
                <>
                  <div className="admin-result-meta">
                    <div className="modal-stat">
                      <span>Model</span>
                      <strong>{job.result.model.label}</strong>
                    </div>
                    <div className="modal-stat">
                      <span>Provider</span>
                      <strong>{job.result.model.provider}</strong>
                    </div>
                    <div className="modal-stat">
                      <span>Round</span>
                      <strong>{job.result.game.round}</strong>
                    </div>
                  </div>

                  <div className="leaderboard-matchup admin-matchup">
                    <div className={`bracket-team ${job.result.pick.winnerName === job.result.game.slotA ? "bracket-team-winner" : ""}`}>
                      <span>{job.result.game.slotA}</span>
                    </div>
                    <div className={`bracket-team ${job.result.pick.winnerName === job.result.game.slotB ? "bracket-team-winner" : ""}`}>
                      <span>{job.result.game.slotB}</span>
                    </div>
                  </div>

                  <div className="admin-result-callout">
                    <div className="leader-bottomline leader-bottomline-nowrap">
                      <span>Winner</span>
                      <strong>{job.result.pick.winnerName}</strong>
                    </div>
                    <div className="leader-bottomline leader-bottomline-nowrap">
                      <span>Confidence</span>
                      <strong>{Math.round(job.result.pick.confidence * 100)}%</strong>
                    </div>
                  </div>

                  <section className="modal-section">
                    <h3>Rationale</h3>
                    <p>{job.result.pick.rationale}</p>
                  </section>

                  {job.result.reasoningStep ? (
                    <section className="modal-section">
                      <h3>Reasoning Step</h3>
                      <p>{job.result.reasoningStep.summary}</p>
                      <ul>
                        {job.result.reasoningStep.evidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : (
                <p>Waiting for the model to finish...</p>
              )}

              <section className="modal-section">
                <h3>Tool Calls</h3>
                {job.toolCalls.length === 0 ? (
                  <p>No tool calls recorded yet.</p>
                ) : (
                  <div className="modal-tool-list">
                    {job.toolCalls.map((call) => (
                      <article className="trace-card" key={call.id}>
                        <div className="leader-topline">
                          <strong>{call.toolName}</strong>
                          <span>{call.summary}</span>
                        </div>
                        <pre className="code-block">{JSON.stringify(call.arguments, null, 2)}</pre>
                        <pre className="code-block">{JSON.stringify(call.result, null, 2)}</pre>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <p>Run a matchup to see the live trace and result here.</p>
          )}
        </section>
      </div>
    </main>
  );
}
