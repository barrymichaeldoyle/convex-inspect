import { ConvexPanel, convexPanelBus } from 'convex-inspect/react';

let idCounter = 0;
function nextId() {
  return `docs-${Date.now()}-${++idCounter}`;
}

function emitEvent(
  type: 'query' | 'mutation' | 'action',
  name: string,
  args: unknown,
  delay: number,
) {
  const id = nextId();
  const startedAt = Date.now();
  convexPanelBus.emit({ id, type, name, args, status: 'loading', startedAt });
  setTimeout(() => {
    const ok = Math.random() > 0.18;
    convexPanelBus.emit({
      id,
      type,
      name,
      args,
      status: ok ? 'success' : 'error',
      result: ok
        ? type === 'query'
          ? [{ _id: 'abc123', text: 'Example task' }]
          : { ok: true }
        : undefined,
      error: ok ? undefined : 'ConvexError: simulated failure',
      startedAt,
      completedAt: Date.now(),
    });
  }, delay);
}

export function LiveDemo() {
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '24px',
          background: 'var(--sl-color-gray-6)',
          border: '1px solid var(--sl-color-gray-5)',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--sl-color-gray-2)',
          }}
        >
          Open the panel in the bottom-right corner, then trigger some events:
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <DemoButton
            label="Trigger query"
            color="#60a5fa"
            onClick={() =>
              emitEvent('query', 'tasks:list', {}, 180 + Math.random() * 240)
            }
          />
          <DemoButton
            label="Trigger mutation"
            color="#4ade80"
            onClick={() =>
              emitEvent(
                'mutation',
                'tasks:add',
                { text: 'Buy milk' },
                320 + Math.random() * 520,
              )
            }
          />
          <DemoButton
            label="Trigger action"
            color="#fb923c"
            onClick={() =>
              emitEvent(
                'action',
                'email:send',
                { to: 'user@example.com' },
                720 + Math.random() * 820,
              )
            }
          />
        </div>
      </div>
      <ConvexPanel defaultOpen={false} />
    </>
  );
}

function DemoButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        height: '42px',
        flex: '0 0 auto',
        margin: 0,
        verticalAlign: 'middle',
        padding: '8px 16px',
        borderRadius: '6px',
        border: `1px solid ${color}33`,
        background: `${color}15`,
        color,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
