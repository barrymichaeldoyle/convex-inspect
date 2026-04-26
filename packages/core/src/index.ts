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
  startedAt: number;
  completedAt?: number;
}

type Listener = (events: ConvexEvent[]) => void;

class ConvexPanelBus {
  private events: ConvexEvent[] = [];
  private listeners = new Set<Listener>();

  emit(event: ConvexEvent) {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.events = this.events.map((e, i) => (i === idx ? event : e));
    } else {
      this.events = [...this.events, event].slice(-200);
    }
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

export function createConvexDevClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const val = (target as Record<string | symbol, unknown>)[prop];
      if ((prop === "mutation" || prop === "action") && typeof val === "function") {
        const type = prop as "mutation" | "action";
        return (ref: unknown, args: unknown) => {
          const id = createEventId();
          const name = getFnName(ref);
          const startedAt = Date.now();
          convexPanelBus.emit({ id, type, name, args, status: "loading", startedAt });
          const promise = (val as Function).call(target, ref, args) as Promise<unknown>;
          promise.then((result) => {
            convexPanelBus.emit({ id, type, name, args, status: "success", result, startedAt, completedAt: Date.now() });
          }).catch((err: unknown) => {
            convexPanelBus.emit({ id, type, name, args, status: "error", error: String(err), startedAt, completedAt: Date.now() });
          });
          return promise;
        };
      }
      if (typeof val === "function") return val.bind(target);
      return val;
    },
  });
}
