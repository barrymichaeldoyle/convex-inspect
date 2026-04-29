import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexPanelBus, createConvexDevClient, extractError } from "./index.js";

beforeEach(() => convexPanelBus.clear());
afterEach(() => {
  delete globalThis.__CONVEX_INSPECT_DEV__;
});

describe("convexPanelBus", () => {
  it("notifies subscriber immediately with current events", () => {
    const listener = vi.fn();
    const unsub = convexPanelBus.subscribe(listener);
    expect(listener).toHaveBeenCalledWith([]);
    unsub();
  });

  it("emits events to subscribers", () => {
    const listener = vi.fn();
    const unsub = convexPanelBus.subscribe(listener);
    convexPanelBus.emit({
      id: "1",
      type: "mutation",
      name: "tasks:add",
      args: { text: "hello" },
      status: "success",
      startedAt: Date.now(),
    });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].at(-1)!.name).toBe("tasks:add");
    unsub();
  });

  it("updates existing event in-place by id", () => {
    const listener = vi.fn();
    const unsub = convexPanelBus.subscribe(listener);
    const base = { id: "42", type: "mutation" as const, name: "foo", args: {}, status: "loading" as const, startedAt: 0 };
    convexPanelBus.emit(base);
    convexPanelBus.emit({ ...base, status: "success", completedAt: 1 });
    const events = listener.mock.calls.at(-1)![0];
    expect(events).toHaveLength(1);
    expect(events.at(-1)!.status).toBe("success");
    unsub();
  });

  it("caps at 200 events, keeping newest", () => {
    for (let i = 0; i < 210; i++) {
      convexPanelBus.emit({ id: String(i), type: "mutation", name: `fn-${i}`, args: {}, status: "success", startedAt: 0 });
    }
    const events = convexPanelBus.getEvents();
    expect(events).toHaveLength(200);
    expect(events.at(-1)!.id).toBe("209");
  });

  it("clear removes all events", () => {
    convexPanelBus.emit({ id: "x", type: "action", name: "fn", args: {}, status: "success", startedAt: 0 });
    convexPanelBus.clear();
    expect(convexPanelBus.getEvents()).toHaveLength(0);
  });

  it("groups consecutive identical terminal events into a single row with count", () => {
    const base = { type: "mutation" as const, name: "tasks:add", args: { text: "hi" } };
    convexPanelBus.emit({ id: "a", ...base, status: "loading", startedAt: 1 });
    convexPanelBus.emit({ id: "a", ...base, status: "success", startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "b", ...base, status: "loading", startedAt: 3 });
    convexPanelBus.emit({ id: "b", ...base, status: "success", startedAt: 3, completedAt: 4 });
    convexPanelBus.emit({ id: "c", ...base, status: "loading", startedAt: 5 });
    convexPanelBus.emit({ id: "c", ...base, status: "success", startedAt: 5, completedAt: 6 });

    const events = convexPanelBus.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(3);
    expect(events[0].startedAt).toBe(1);
    expect(events[0].completedAt).toBe(6);
  });

  it("does not group when args differ", () => {
    const base = { type: "mutation" as const, name: "tasks:add" };
    convexPanelBus.emit({ id: "a", ...base, args: { text: "x" }, status: "success", startedAt: 1 });
    convexPanelBus.emit({ id: "b", ...base, args: { text: "y" }, status: "success", startedAt: 2 });
    expect(convexPanelBus.getEvents()).toHaveLength(2);
  });

  it("groups when args are structurally equal but object keys were inserted in a different order", () => {
    const base = { type: "mutation" as const, name: "tasks:add", status: "success" as const };
    convexPanelBus.emit({ id: "a", ...base, args: { text: "hi", done: false }, result: { ok: true }, startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "b", ...base, args: { done: false, text: "hi" }, result: { ok: true }, startedAt: 3, completedAt: 4 });

    const events = convexPanelBus.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(2);
  });

  it("does not group while a call is still loading", () => {
    const base = { type: "mutation" as const, name: "tasks:add", args: { text: "hi" } };
    convexPanelBus.emit({ id: "a", ...base, status: "success", startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "b", ...base, status: "loading", startedAt: 3 });
    expect(convexPanelBus.getEvents()).toHaveLength(2);
  });

  it("does not group successful calls when the results differ", () => {
    const base = { type: "query" as const, name: "tasks:list", args: { list: "all" }, status: "success" as const };
    convexPanelBus.emit({ id: "a", ...base, result: ["a"], startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "b", ...base, result: ["b"], startedAt: 3, completedAt: 4 });
    expect(convexPanelBus.getEvents()).toHaveLength(2);
  });

  it("does not group error calls when the messages differ", () => {
    const base = { type: "mutation" as const, name: "tasks:add", args: { text: "hi" }, status: "error" as const };
    convexPanelBus.emit({ id: "a", ...base, error: "permission denied", startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "b", ...base, error: "rate limited", startedAt: 3, completedAt: 4 });
    expect(convexPanelBus.getEvents()).toHaveLength(2);
  });
});

describe("extractError", () => {
  it("extracts message and stack from an Error", () => {
    const err = new Error("nope");
    const out = extractError(err);
    expect(out.error).toBe("nope");
    expect(out.errorStack).toContain("Error");
    expect(out.errorData).toBeUndefined();
  });

  it("extracts ConvexError-style data from the error", () => {
    class FakeConvexError extends Error {
      data: unknown;
      constructor(message: string, data: unknown) {
        super(message);
        this.data = data;
      }
    }
    const out = extractError(new FakeConvexError("bad input", { field: "name" }));
    expect(out.error).toBe("bad input");
    expect(out.errorData).toEqual({ field: "name" });
  });

  it("falls back to String(err) for non-Error values", () => {
    expect(extractError("oops").error).toBe("oops");
    expect(extractError(42).error).toBe("42");
  });
});

describe("createConvexDevClient", () => {
  it("intercepts mutation calls and logs loading then success", async () => {
    const result = { ok: true };
    const fakeClient = {
      mutation: vi.fn().mockResolvedValue(result),
    };
    const dev = createConvexDevClient(fakeClient);
    const ref = { _name: "tasks:add" };

    await (dev as typeof fakeClient).mutation(ref, { text: "hi" });

    const events = convexPanelBus.getEvents();
    expect(events).toHaveLength(1);
    expect(events.at(-1)!.type).toBe("mutation");
    expect(events.at(-1)!.name).toBe("tasks:add");
    expect(events.at(-1)!.status).toBe("success");
  });

  it("logs error status when mutation rejects", async () => {
    const fakeClient = {
      mutation: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const dev = createConvexDevClient(fakeClient);

    await (dev as typeof fakeClient).mutation({ _name: "tasks:delete" }, {}).catch(() => {});

    const events = convexPanelBus.getEvents();
    expect(events.at(-1)!.status).toBe("error");
    expect(events.at(-1)!.error).toContain("boom");
  });

  it("does not emit events when devtools are disabled", async () => {
    globalThis.__CONVEX_INSPECT_DEV__ = false;

    const fakeClient = {
      mutation: vi.fn().mockResolvedValue({ ok: true }),
    };
    const dev = createConvexDevClient(fakeClient);

    await (dev as typeof fakeClient).mutation({ _name: "tasks:add" }, { text: "hi" });

    expect(fakeClient.mutation).toHaveBeenCalledTimes(1);
    expect(convexPanelBus.getEvents()).toHaveLength(0);
  });

  it("passes through non-intercepted properties", () => {
    const fakeClient = { someValue: 42, query: () => "q" };
    const dev = createConvexDevClient(fakeClient) as typeof fakeClient;
    expect(dev.someValue).toBe(42);
  });
});
