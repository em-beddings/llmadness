import { ReasoningStep } from "@/lib/types";

export function TracePanel({ steps }: { steps: ReasoningStep[] }) {
  return (
    <section className="panel">
      <div className="section-header">
        <h2>Reasoning Trace</h2>
        <p>Saved as JSON alongside each bracket submission.</p>
      </div>
      <div className="trace-list">
        {steps.map((step) => (
          <article className="trace-card" key={step.id}>
            <h3>{step.title}</h3>
            <p>{step.summary}</p>
            <ul>
              {step.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
