import { AgentToolCall } from "@/lib/types";

export function ToolCallPanel({ calls }: { calls: AgentToolCall[] }) {
  return (
    <section className="panel">
      <div className="section-header">
        <h2>Tool Calls</h2>
        <p>Exact tool transcript captured during bracket generation.</p>
      </div>
      {calls.length === 0 ? (
        <p>This run did not record any tool invocations.</p>
      ) : (
        <div className="trace-list">
          {calls.map((call) => (
            <article className="trace-card" key={call.id}>
              <h3>{call.toolName}</h3>
              <p>{call.summary}</p>
              <pre className="code-block">{JSON.stringify(call.arguments, null, 2)}</pre>
              <pre className="code-block">{JSON.stringify(call.result, null, 2)}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
