import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexPanelBus, createConvexDevClient } from "./index.js";

beforeEach(() => convexPanelBus.clear());

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
      convexPanelBus.emit({ id: String(i), type: "mutation", name: "fn", args: {}, status: "success", startedAt: 0 });
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

  it("passes through non-intercepted properties", () => {
    const fakeClient = { someValue: 42, query: () => "q" };
    const dev = createConvexDevClient(fakeClient) as typeof fakeClient;
    expect(dev.someValue).toBe(42);
  });
});
