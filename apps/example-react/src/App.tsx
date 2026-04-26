import { ConvexPanel, convexPanelBus, useQuery, useMutation, useAction } from "convex-panel/react";

let idCounter = 0;
function nextId() {
  return `demo-${Date.now()}-${++idCounter}`;
}

function simulateMutation(name: string, args: unknown) {
  const id = nextId();
  const startedAt = Date.now();
  convexPanelBus.emit({ id, type: "mutation", name, args, status: "loading", startedAt });
  setTimeout(() => {
    const success = Math.random() > 0.2;
    convexPanelBus.emit({
      id,
      type: "mutation",
      name,
      args,
      status: success ? "success" : "error",
      result: success ? { ok: true } : undefined,
      error: success ? undefined : "ConvexError: permission denied",
      startedAt,
      completedAt: Date.now(),
    });
  }, 300 + Math.random() * 700);
}

function simulateAction(name: string, args: unknown) {
  const id = nextId();
  const startedAt = Date.now();
  convexPanelBus.emit({ id, type: "action", name, args, status: "loading", startedAt });
  setTimeout(() => {
    convexPanelBus.emit({
      id,
      type: "action",
      name,
      args,
      status: "success",
      result: { processed: true },
      startedAt,
      completedAt: Date.now(),
    });
  }, 800 + Math.random() * 1200);
}

function simulateQuery(name: string, args: unknown) {
  const id = nextId();
  const startedAt = Date.now();
  convexPanelBus.emit({ id, type: "query", name, args, status: "loading", startedAt });
  setTimeout(() => {
    convexPanelBus.emit({
      id,
      type: "query",
      name,
      args,
      status: "success",
      result: [{ _id: "abc123", text: "Example task" }],
      startedAt,
      completedAt: Date.now(),
    });
  }, 100 + Math.random() * 300);
}

export function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 40, maxWidth: 520 }}>
      <h1 style={{ marginBottom: 8, fontSize: 22, color: "#cdd6f4" }}>Convex Panel</h1>
      <p style={{ color: "#6c7086", marginBottom: 32, fontSize: 14, lineHeight: 1.6 }}>
        Click the buttons below to simulate Convex events. Open the panel in the bottom-right corner.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Row label="Query" color="#60a5fa">
          <Btn onClick={() => simulateQuery("tasks:list", {})}>tasks:list</Btn>
          <Btn onClick={() => simulateQuery("users:get", { id: "u_123" })}>users:get</Btn>
        </Row>
        <Row label="Mutation" color="#4ade80">
          <Btn onClick={() => simulateMutation("tasks:add", { text: "Buy milk" })}>tasks:add</Btn>
          <Btn onClick={() => simulateMutation("tasks:remove", { id: "t_456" })}>tasks:remove</Btn>
        </Row>
        <Row label="Action" color="#fb923c">
          <Btn onClick={() => simulateAction("email:send", { to: "user@example.com" })}>email:send</Btn>
          <Btn onClick={() => simulateAction("ai:summarize", { docId: "d_789" })}>ai:summarize</Btn>
        </Row>
      </div>

      <ConvexPanel />
    </div>
  );
}

function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 70, fontSize: 12, fontWeight: 700, color }}>{label}</span>
      {children}
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        border: "1px solid #313244",
        borderRadius: 6,
        background: "#181825",
        color: "#cdd6f4",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
