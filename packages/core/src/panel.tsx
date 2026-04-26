import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { convexPanelBus, type ConvexEvent, type ConvexEventType } from "./index.js";

const STYLE_ID = "convex-panel-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes convex-panel-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.15; }
    }
    @keyframes convex-panel-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes convex-panel-out {
      from { opacity: 1; transform: translateY(0)    scale(1);    }
      to   { opacity: 0; transform: translateY(10px) scale(0.97); }
    }
    .convex-panel-fab {
      transition: background 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease !important;
    }
    .convex-panel-fab:hover {
      background: #27273a !important;
      border-color: #45475a !important;
      transform: scale(1.08) !important;
      box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important;
    }
    .convex-panel-btn {
      appearance: none;
      -webkit-appearance: none;
    }
    .convex-panel-icon-btn:hover { color: #cdd6f4 !important; }
    .convex-panel-row-summary {
      transition: background 150ms ease;
    }
    .convex-panel-row-summary:hover {
      background: rgba(69, 71, 90, 0.35);
    }
    .convex-panel-log-row {
      overflow: hidden;
      transition: box-shadow 120ms ease, background 120ms ease;
    }
    .convex-panel-log-row:last-child {
      border-bottom: none !important;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
    .convex-panel-log-row:has(.convex-panel-row-summary:focus-visible) {
      box-shadow: inset 0 0 0 1px #89b4fa !important;
    }
    .convex-panel-pre-wrap {
      position: relative;
    }
    .convex-panel-copy-btn {
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
    }
    .convex-panel-pre-wrap:hover .convex-panel-copy-btn,
    .convex-panel-pre-wrap:focus-within .convex-panel-copy-btn {
      opacity: 1;
      pointer-events: auto;
    }
    .convex-panel-root button:focus,
    .convex-panel-row-summary:focus {
      outline: none !important;
      box-shadow: none !important;
    }
    .convex-panel-root button:focus-visible,
    .convex-panel-row-summary:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}

function ConvexSymbol({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 184 188" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M108.092 130.021C126.258 128.003 143.385 118.323 152.815 102.167C148.349 142.128 104.653 167.385 68.9858 151.878C65.6992 150.453 62.8702 148.082 60.9288 145.034C52.9134 132.448 50.2786 116.433 54.0644 101.899C64.881 120.567 86.8748 132.01 108.092 130.021Z" fill="#F3B01C"/>
      <path d="M53.4012 90.1735C46.0375 107.191 45.7186 127.114 54.7463 143.51C22.9759 119.608 23.3226 68.4578 54.358 44.7949C57.2286 42.6078 60.64 41.3097 64.2178 41.1121C78.9312 40.336 93.8804 46.0225 104.364 56.6193C83.0637 56.831 62.318 70.4756 53.4012 90.1735Z" fill="#8D2676"/>
      <path d="M114.637 61.8552C103.89 46.8701 87.0686 36.6684 68.6387 36.358C104.264 20.1876 148.085 46.4045 152.856 85.1654C153.3 88.7635 152.717 92.4322 151.122 95.6775C144.466 109.195 132.124 119.679 117.702 123.559C128.269 103.96 126.965 80.0151 114.637 61.8552Z" fill="#EE342F"/>
    </svg>
  );
}

const COLORS: Record<ConvexEventType, { bg: string; text: string }> = {
  query: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" },
  mutation: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  action: { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
};

const STATUS_COLORS: Record<string, string> = {
  loading: "#94a3b8",
  success: "#4ade80",
  error: "#f87171",
};

export interface ConvexPanelProps {
  defaultOpen?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

const LS_TIMESTAMPS = "convex-inspect:show-timestamps";
const LS_BADGE = "convex-inspect:show-badge";
const LS_OPEN = "convex-inspect:open";
const LS_FILTER = "convex-inspect:filter";

function readPref(key: string, defaultVal = true): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultVal : stored === "true";
  } catch {
    return defaultVal;
  }
}

function writePref(key: string, val: boolean) {
  try {
    localStorage.setItem(key, String(val));
  } catch {}
}

export function ConvexPanel({ defaultOpen = false }: ConvexPanelProps) {
  const [open, setOpen] = useState(() => readPref(LS_OPEN, defaultOpen));
  const [isClosing, setIsClosing] = useState(false);
  const [events, setEvents] = useState<ConvexEvent[]>([]);
  const [filter, setFilter] = useState<ConvexEventType | "all">(() => {
    try {
      const stored = localStorage.getItem(LS_FILTER);
      return (stored as ConvexEventType | "all") ?? "all";
    } catch {
      return "all";
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(() => readPref(LS_TIMESTAMPS));
  const [showBadge, setShowBadge] = useState(() => readPref(LS_BADGE));
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  function handleOpen() {
    setOpen(true);
    writePref(LS_OPEN, true);
  }

  function handleClose() {
    setIsClosing(true);
    writePref(LS_OPEN, false);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 180);
  }

  useEffect(() => convexPanelBus.subscribe(setEvents), []);

  const visible = filter === "all" ? events : events.filter((event) => event.type === filter);
  const activeFilterColor = filter === "all" ? null : COLORS[filter].text;

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  function toggleTimestamps(val: boolean) {
    setShowTimestamps(val);
    writePref(LS_TIMESTAMPS, val);
  }

  function toggleBadge(val: boolean) {
    setShowBadge(val);
    writePref(LS_BADGE, val);
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        style={styles.fab}
        className="convex-panel-root convex-panel-fab"
        aria-label="Open Convex Inspect"
        aria-haspopup="dialog"
      >
        <ConvexSymbol size={30} />
        {showBadge && events.length > 0 && (
          <span
            aria-label={`${events.length} events`}
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "#89b4fa",
              color: "#1e1e2e",
              borderRadius: 10,
              fontSize: 9,
              fontWeight: 700,
              padding: "0 4px",
              minWidth: 16,
              height: 16,
              boxSizing: "border-box",
              textAlign: "center",
              lineHeight: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {events.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Convex Inspect"
      className="convex-panel-root"
      style={{ ...styles.panel, animation: `${isClosing ? "convex-panel-out" : "convex-panel-in"} 180ms ease forwards` }}
    >
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConvexSymbol size={20} />
          <span style={styles.title}>Convex Inspect</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => convexPanelBus.clear()}
            style={styles.iconBtn}
            className="convex-panel-btn convex-panel-icon-btn"
            aria-label="Clear events"
          >
            Clear
          </button>
          <button
            onClick={() => setShowSettings((value) => !value)}
            style={{ ...styles.iconBtn, color: showSettings ? "#cdd6f4" : "#6c7086" }}
            className="convex-panel-btn convex-panel-icon-btn"
            aria-label="Toggle settings"
            aria-expanded={showSettings}
          >
            Settings
          </button>
          <button
            onClick={() => setShowFilters((value) => !value)}
            style={{ ...styles.iconBtn, color: showFilters || filter !== "all" ? "#cdd6f4" : "#6c7086", position: "relative" }}
            className="convex-panel-btn convex-panel-icon-btn"
            aria-label="Toggle filters"
            aria-expanded={showFilters}
          >
            Filter
            {activeFilterColor && (
              <span
                aria-label={`Filtering ${filter} events`}
                style={{
                  ...styles.filterIndicator,
                  background: activeFilterColor,
                  boxShadow: `0 0 0 2px ${styles.header.background as string}`,
                }}
              />
            )}
          </button>
          <button
            onClick={handleClose}
            style={styles.iconBtn}
            className="convex-panel-btn convex-panel-icon-btn"
            aria-label="Close Convex Inspect"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateRows: showSettings ? "1fr" : "0fr", transition: "grid-template-rows 200ms ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={styles.settings} role="group" aria-label="Panel settings">
            <SettingRow label="Show timestamps">
              <Toggle checked={showTimestamps} onChange={toggleTimestamps} aria-label="Show timestamps" tabIndex={showSettings ? undefined : -1} />
            </SettingRow>
            <SettingRow label="Show count badge">
              <Toggle checked={showBadge} onChange={toggleBadge} aria-label="Show count badge" tabIndex={showSettings ? undefined : -1} />
            </SettingRow>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateRows: showFilters ? "1fr" : "0fr", transition: "grid-template-rows 200ms ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div role="tablist" aria-label="Filter events" style={styles.filters}>
            {(["all", "query", "mutation", "action"] as const).map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={filter === type}
                onClick={() => {
                  setFilter(type);
                  try {
                    localStorage.setItem(LS_FILTER, type);
                  } catch {}
                }}
                className="convex-panel-btn"
                tabIndex={showFilters ? undefined : -1}
                style={{
                  ...styles.filterBtn,
                  ...(filter === type ? styles.filterBtnActive : {}),
                  ...(type !== "all" ? { color: COLORS[type].text } : {}),
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-label="Convex events"
        aria-live="polite"
        style={styles.list}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
        }}
      >
        {visible.length === 0 ? (
          <div style={styles.empty}>No events yet. Run a query or mutation.</div>
        ) : (
          visible.map((event) => <EventRow key={event.id} e={event} showTimestamps={showTimestamps} />)
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ color: "#bac2de", fontSize: 12 }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle(
  { checked, onChange, ...props }: { checked: boolean; onChange(v: boolean): void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        border: "none",
        background: checked ? "linear-gradient(90deg, #8D2676 0%, #EE342F 100%)" : "#585b70",
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
      {...props}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#eff1f5",
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}

function EventRow({ e, showTimestamps }: { e: ConvexEvent; showTimestamps: boolean }) {
  const [open, setOpen] = useState(false);
  const detailId = `convex-panel-detail-${e.id}`;

  function handleRowClick(event: ReactMouseEvent<HTMLDivElement>) {
    const selection = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
    if (selection) return;

    const target = event.target as HTMLElement;
    if (target.closest("[data-convex-panel-detail]")) return;

    setOpen((value) => !value);
  }

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setOpen((value) => !value);
  }

  return (
    <div style={styles.row} className="convex-panel-log-row">
      <div
        style={styles.rowSummary}
        className="convex-panel-row-summary"
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={detailId}
      >
        <span style={{ ...styles.badge, background: COLORS[e.type].bg, color: COLORS[e.type].text }}>{e.type}</span>
        <span style={{ color: "#cdd6f4", fontWeight: 600 }}>{e.name}</span>
        <span style={{ color: STATUS_COLORS[e.status], fontSize: 11 }}>{e.status}</span>
        {showTimestamps && <span style={{ color: "#6c7086", marginLeft: "auto" }}>{formatTime(e.completedAt ?? e.startedAt)}</span>}
      </div>
      <div style={{ ...styles.detailRegion, gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div
          style={{ ...styles.detailRegionInner, visibility: open ? "visible" : "hidden" }}
          aria-hidden={!open}
        >
          <div id={detailId} style={styles.detailWrap} data-convex-panel-detail="true">
            <JsonBlock label="Args" value={e.args} />
            {"result" in e && e.result !== undefined && <JsonBlock label="Result" value={e.result} />}
            {"error" in e && e.error && <JsonBlock label="Error" value={e.error} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const formatted = JSON.stringify(value, null, 2);

  async function handleCopy(event: ReactMouseEvent<HTMLButtonElement>) {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      event.currentTarget.blur();
    } catch {}
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.preWrap} className="convex-panel-pre-wrap">
        <button
          type="button"
          onClick={handleCopy}
          className="convex-panel-btn convex-panel-copy-btn"
          aria-label={`Copy ${label}`}
          style={styles.copyBtn}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre style={styles.pre}>{formatted}</pre>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  fab: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    background: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: "50%",
    color: "#cdd6f4",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    outline: "none",
  },
  badge: {
    background: "#89b4fa",
    color: "#1e1e2e",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 5px",
  },
  panel: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 9999,
    width: 480,
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
    background: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: 12,
    color: "#cdd6f4",
    fontFamily: "monospace",
    fontSize: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #313244",
    background: "#181825",
  },
  title: { fontWeight: 700, fontSize: 13, color: "#cdd6f4" },
  iconBtn: {
    background: "none",
    border: "none",
    outline: "none",
    color: "#6c7086",
    cursor: "pointer",
    fontSize: 13,
    padding: "2px 6px",
    borderRadius: 4,
  },
  filterIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: "50%",
  },
  filters: {
    display: "flex",
    gap: 4,
    padding: "8px 14px",
    borderBottom: "1px solid #313244",
  },
  filterBtn: {
    background: "none",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#313244",
    borderRadius: 6,
    color: "#6c7086",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.2,
    minWidth: 56,
    padding: "2px 8px",
    outline: "none",
  },
  filterBtnActive: {
    background: "#45475a",
    color: "#cdd6f4",
    borderColor: "#585b70",
  },
  list: {
    overflowY: "auto",
    flex: 1,
  },
  settings: {
    padding: "10px 14px",
    borderBottom: "1px solid #313244",
    background: "#181825",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  empty: {
    padding: "24px 14px",
    color: "#6c7086",
    textAlign: "center",
  },
  row: {
    borderBottom: "1px solid #27273a",
  },
  rowSummary: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    padding: "8px 14px",
  },
  detailWrap: {
    padding: "8px 14px 12px",
    borderTop: "1px dashed #313244",
  },
  detailRegion: {
    display: "grid",
    gridTemplateRows: "0fr",
    transition: "grid-template-rows 180ms ease",
  },
  detailRegionInner: {
    overflow: "hidden",
  },
  detailLabel: {
    color: "#bac2de",
    marginBottom: 4,
    fontSize: 11,
  },
  preWrap: {
    position: "relative",
  },
  pre: {
    margin: 0,
    background: "#11111b",
    border: "1px solid #313244",
    borderRadius: 8,
    padding: "8px 56px 8px 8px",
    overflowX: "auto",
    color: "#cdd6f4",
    fontSize: 11,
  },
  copyBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    border: "1px solid #45475a",
    background: "#181825",
    color: "#bac2de",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    cursor: "pointer",
    zIndex: 1,
  },
};
