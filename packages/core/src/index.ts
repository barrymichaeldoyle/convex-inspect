import { isDevEnvironment } from "./env.js";
export { resetConvexInspectEnabled, setConvexInspectEnabled } from "./env.js";

export type ConvexEventType = "query" | "mutation" | "action";
export type ConvexEventStatus = "loading" | "success" | "error";

export interface ConvexEvent {
  id: string;
  type: ConvexEventType;
  name: string;
  args: unknown;
  status: ConvexEventStatus;
  result?: unknown;
  error?: string;
  errorData?: unknown;
  errorStack?: string;
  startedAt: number;
  completedAt?: number;
  count?: number;
}

type Listener = (events: ConvexEvent[]) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!sameValue(a[i], b[i])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i += 1) {
      const key = aKeys[i];
      if (key !== bKeys[i]) return false;
      if (!sameValue(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function sameLogicalCall(a: ConvexEvent, b: ConvexEvent): boolean {
  if (a.type !== b.type || a.name !== b.name || a.status !== b.status) return false;
  if (!sameValue(a.args ?? null, b.args ?? null)) return false;
  if (a.status === "success") return sameValue(a.result ?? null, b.result ?? null);
  if (a.status === "error") {
    return a.error === b.error
      && sameValue(a.errorData ?? null, b.errorData ?? null);
  }
  return true;
}

function consolidate(events: ConvexEvent[]): ConvexEvent[] {
  const out: ConvexEvent[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    if (
      last &&
      (event.status === "success" || event.status === "error") &&
      sameLogicalCall(last, event)
    ) {
      out[out.length - 1] = {
        ...event,
        id: last.id,
        count: (last.count ?? 1) + 1,
        startedAt: last.startedAt,
      };
    } else {
      out.push(event);
    }
  }
  return out;
}

class ConvexPanelBus {
  private events: ConvexEvent[] = [];
  private listeners = new Set<Listener>();

  emit(event: ConvexEvent) {
    const idx = this.events.findIndex((e) => e.id === event.id);
    let next: ConvexEvent[];
    if (idx >= 0) {
      next = this.events.map((e, i) => (i === idx ? event : e));
    } else {
      next = [...this.events, event].slice(-200);
    }
    this.events = consolidate(next);
    for (const l of this.listeners) l(this.events);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.events);
    return () => { this.listeners.delete(listener); };
  }

  getEvents() {
    return this.events;
  }

  clear() {
    this.events = [];
    for (const l of this.listeners) l(this.events);
  }
}

export const convexPanelBus = new ConvexPanelBus();

let idCounter = 0;
export function createEventId() {
  return `cp-${Date.now()}-${++idCounter}`;
}

export function getFnName(ref: unknown): string {
  if (ref && typeof ref === "object" && "_name" in ref) return String((ref as { _name: string })._name);
  if (typeof ref === "string") return ref;
  return "unknown";
}

export interface ExtractedError {
  error: string;
  errorData?: unknown;
  errorStack?: string;
}

export function extractError(err: unknown): ExtractedError {
  if (err instanceof Error) {
    const data = (err as { data?: unknown }).data;
    return {
      error: err.message || err.name || "Error",
      errorStack: err.stack,
      ...(data !== undefined ? { errorData: data } : {}),
    };
  }
  return { error: String(err) };
}

export function createConvexDevClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const val = (target as Record<string | symbol, unknown>)[prop];
      if ((prop === "mutation" || prop === "action") && typeof val === "function") {
        const type = prop as "mutation" | "action";
        return (ref: unknown, args: unknown) => {
          if (!isDevEnvironment()) {
            return (val as Function).call(target, ref, args);
          }

          const id = createEventId();
          const name = getFnName(ref);
          const startedAt = Date.now();
          convexPanelBus.emit({ id, type, name, args, status: "loading", startedAt });
          const promise = (val as Function).call(target, ref, args) as Promise<unknown>;
          promise.then((result) => {
            convexPanelBus.emit({ id, type, name, args, status: "success", result, startedAt, completedAt: Date.now() });
          }).catch((err: unknown) => {
            convexPanelBus.emit({ id, type, name, args, status: "error", ...extractError(err), startedAt, completedAt: Date.now() });
          });
          return promise;
        };
      }
      if (typeof val === "function") return val.bind(target);
      return val;
    },
  });
}
