// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexPanel } from "./panel.js";
import { convexPanelBus } from "./index.js";

function getShadowRoot() {
  const hosts = document.body.querySelectorAll("[data-convex-panel-host]");
  const host = hosts[hosts.length - 1];
  if (!(host instanceof HTMLElement) || !host.shadowRoot) {
    throw new Error("Expected ConvexPanel shadow host");
  }
  return host.shadowRoot;
}

function getShadowMount() {
  const mount = getShadowRoot().querySelector("[data-convex-panel-mount]");
  if (!(mount instanceof HTMLElement)) {
    throw new Error("Expected ConvexPanel shadow mount");
  }
  return mount;
}

async function getShadowView() {
  await waitFor(() => expect(getShadowMount()).toBeTruthy());
  return within(getShadowMount());
}

function seedEvent(id: string, name = "tasks:add") {
  convexPanelBus.emit({
    id,
    type: "mutation",
    name,
    args: { text: "Buy milk" },
    status: "success",
    result: { ok: true },
    startedAt: 1,
    completedAt: 2,
  });
}

beforeEach(() => {
  cleanup();
  convexPanelBus.clear();
  localStorage.clear();
});

describe("ConvexPanel accessibility", () => {
  it("supports keyboard expansion and collapse on event rows", async () => {
    seedEvent("event-1");
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();

    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-event-1"]');
    if (!(rowSummary instanceof HTMLDivElement)) {
      throw new Error("Expected row summary button to exist");
    }

    expect(rowSummary.getAttribute("role")).toBe("button");
    expect(rowSummary.getAttribute("tabindex")).toBe("0");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("false");

    rowSummary.focus();
    await user.keyboard("{Enter}");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("true");
    within(shadowMount).getByText("Args");

    await user.keyboard(" ");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("false");
  });

  it("removes collapsed detail actions from the accessibility tree", async () => {
    seedEvent("event-2", "tasks:delete");
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();

    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-event-2"]');
    if (!(rowSummary instanceof HTMLDivElement)) {
      throw new Error("Expected row summary button to exist");
    }
    const detailWrap = shadowMount.querySelector("#convex-panel-detail-event-2");
    if (!(detailWrap instanceof HTMLDivElement) || !(detailWrap.parentElement instanceof HTMLDivElement)) {
      throw new Error("Expected detail region to exist");
    }
    const detailRegion = detailWrap.parentElement;

    expect(within(shadowMount).queryByRole("button", { name: "Copy Args" })).toBeNull();
    expect(detailRegion.getAttribute("aria-hidden")).toBe("true");

    await user.click(rowSummary);
    await waitFor(() => expect(detailRegion.getAttribute("aria-hidden")).toBe("false"));

    await user.click(rowSummary);
    await waitFor(() => expect(detailRegion.getAttribute("aria-hidden")).toBe("true"));
  });

  it("keeps collapsed detail actions out of the accessibility tree while row summaries remain focusable", () => {
    seedEvent("event-3", "tasks:list");
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();
    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-event-3"]');
    if (!(rowSummary instanceof HTMLElement)) throw new Error("Expected row summary");
    expect(rowSummary.tabIndex).toBe(0);
    expect(within(shadowMount).queryByRole("button", { name: "Copy Args" })).toBeNull();
  });

  it("scrolls expanded bottom-row details into view", async () => {
    seedEvent("event-4", "tasks:first");
    seedEvent("event-5", "tasks:second");
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();

    const list = within(shadowMount).getByRole("log", { name: "Convex events" }) as HTMLDivElement;
    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-event-5"]');
    const detailWrap = shadowMount.querySelector("#convex-panel-detail-event-5");
    if (!(rowSummary instanceof HTMLDivElement) || !(detailWrap instanceof HTMLDivElement)) {
      throw new Error("Expected bottom row and detail region to exist");
    }

    vi.spyOn(list, "getBoundingClientRect").mockImplementation(
      () => ({ top: 0, bottom: 120, left: 0, right: 320, width: 320, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    );
    vi.spyOn(detailWrap, "getBoundingClientRect").mockImplementation(
      () => ({ top: 72, bottom: 180, left: 0, right: 320, width: 320, height: 108, x: 0, y: 72, toJSON: () => ({}) }) as DOMRect,
    );
    expect(list.scrollTop).toBe(0);
    await user.click(rowSummary);

    await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0));
  });
});

describe("ConvexPanel error display", () => {
  it("displays error strings without surrounding JSON quotes", async () => {
    convexPanelBus.emit({
      id: "err-1",
      type: "mutation",
      name: "tasks:add",
      args: { text: "Buy milk" },
      status: "error",
      error: "ConvexError: permission denied",
      startedAt: 1,
      completedAt: 2,
    });
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();

    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-err-1"]');
    if (!(rowSummary instanceof HTMLElement)) throw new Error("Expected row summary");
    await user.click(rowSummary);

    const view = within(shadowMount);
    expect(view.getByText("ConvexError: permission denied")).toBeTruthy();
    expect(view.queryByText('"ConvexError: permission denied"')).toBeNull();
  });

  it("renders structured error data and a hidden stack trace toggle", async () => {
    convexPanelBus.emit({
      id: "err-2",
      type: "mutation",
      name: "tasks:add",
      args: { text: "Buy milk" },
      status: "error",
      error: "permission denied",
      errorData: { field: "userId" },
      errorStack: "Error: permission denied\n    at handler (handler.ts:1:1)",
      startedAt: 1,
      completedAt: 2,
    });
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const shadowMount = getShadowMount();

    const rowSummary = shadowMount.querySelector('[aria-controls="convex-panel-detail-err-2"]');
    if (!(rowSummary instanceof HTMLElement)) throw new Error("Expected row summary");
    await user.click(rowSummary);

    const view = within(shadowMount);
    expect(view.getByText("permission denied")).toBeTruthy();
    expect(view.getByText("Error data")).toBeTruthy();

    expect(view.queryByText(/at handler/)).toBeNull();
    await user.click(view.getByRole("button", { name: "Show stack trace" }));
    await waitFor(() => expect(within(shadowMount).getByText(/at handler/)).toBeTruthy());
  });
});

describe("ConvexPanel search", () => {
  it("filters events by name substring", async () => {
    convexPanelBus.emit({ id: "s-1", type: "query", name: "tasks:list", args: {}, status: "success", result: [], startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "s-2", type: "query", name: "users:get", args: {}, status: "success", result: {}, startedAt: 1, completedAt: 2 });
    render(<ConvexPanel defaultOpen />);
    const view = await getShadowView();

    expect(view.getByText("tasks:list")).toBeTruthy();
    expect(view.getByText("users:get")).toBeTruthy();

    const search = view.getByLabelText("Search events by name") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "tasks" } });
    await waitFor(() => {
      expect(within(getShadowMount()).queryByText("users:get")).toBeNull();
      expect(within(getShadowMount()).getByText("tasks:list")).toBeTruthy();
    });
  });

  it("shows a friendlier empty state when nothing matches the search", async () => {
    convexPanelBus.emit({ id: "s-3", type: "query", name: "tasks:list", args: {}, status: "success", result: [], startedAt: 1, completedAt: 2 });
    render(<ConvexPanel defaultOpen />);
    const view = await getShadowView();

    const search = view.getByLabelText("Search events by name") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "nonexistent" } });
    await waitFor(() => expect(within(getShadowMount()).getByText("No events match your filters.")).toBeTruthy());
  });
});

describe("ConvexPanel grouping", () => {
  it("renders a count badge when consecutive identical calls are grouped", () => {
    const base = { type: "mutation" as const, name: "tasks:add", args: { text: "Buy milk" } };
    convexPanelBus.emit({ id: "g-1", ...base, status: "success", result: { ok: true }, startedAt: 1, completedAt: 2 });
    convexPanelBus.emit({ id: "g-2", ...base, status: "success", result: { ok: true }, startedAt: 3, completedAt: 4 });
    convexPanelBus.emit({ id: "g-3", ...base, status: "success", result: { ok: true }, startedAt: 5, completedAt: 6 });

    render(<ConvexPanel defaultOpen />);
    expect(within(getShadowMount()).getByLabelText("3 occurrences").textContent).toBe("×3");
  });
});

describe("ConvexPanel duration display", () => {
  it("shows duration for completed events", () => {
    convexPanelBus.emit({
      id: "dur-1",
      type: "query",
      name: "tasks:list",
      args: {},
      status: "success",
      result: [],
      startedAt: 1000,
      completedAt: 1342,
    });
    render(<ConvexPanel defaultOpen />);
    expect(within(getShadowMount()).getByText("342ms")).toBeTruthy();
  });

  it("shows seconds for long-running events", () => {
    convexPanelBus.emit({
      id: "dur-2",
      type: "action",
      name: "ai:summarize",
      args: {},
      status: "success",
      result: {},
      startedAt: 0,
      completedAt: 2400,
    });
    render(<ConvexPanel defaultOpen />);
    expect(within(getShadowMount()).getByText("2.4s")).toBeTruthy();
  });

  it("does not show duration for in-flight loading events", () => {
    convexPanelBus.emit({
      id: "dur-3",
      type: "query",
      name: "tasks:list",
      args: {},
      status: "loading",
      startedAt: 1000,
    });
    render(<ConvexPanel defaultOpen />);
    const view = within(getShadowMount());
    expect(view.queryByText(/^\d+ms$/)).toBeNull();
    expect(view.queryByText(/^\d+\.\d+s$/)).toBeNull();
  });
});

describe("ConvexPanel loading pulse animation", () => {
  it("applies pulse animation to the status text of in-flight events", () => {
    convexPanelBus.emit({
      id: "pulse-1",
      type: "query",
      name: "tasks:list",
      args: {},
      status: "loading",
      startedAt: Date.now(),
    });
    render(<ConvexPanel defaultOpen />);
    const loadingStatus = within(getShadowMount()).getByText("loading");
    expect(loadingStatus.style.animation).toContain("convex-panel-pulse");
  });

  it("does not apply pulse animation to completed events", () => {
    convexPanelBus.emit({
      id: "pulse-2",
      type: "query",
      name: "tasks:list",
      args: {},
      status: "success",
      result: [],
      startedAt: 1,
      completedAt: 2,
    });
    render(<ConvexPanel defaultOpen />);
    const successStatus = within(getShadowMount()).getByText("success");
    expect(successStatus.style.animation ?? "").toBe("");
  });
});

describe("ConvexPanel mutually exclusive settings and filter panels", () => {
  it("allows settings and filter panels to be open at the same time", async () => {
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const view = await getShadowView();
    const settingsBtn = view.getByRole("button", { name: "Toggle settings" });
    const filterBtn = view.getByRole("button", { name: "Toggle filters" });

    await user.click(filterBtn);
    await waitFor(() => expect(filterBtn.getAttribute("aria-expanded")).toBe("true"));

    await user.click(settingsBtn);
    await waitFor(() => {
      expect(settingsBtn.getAttribute("aria-expanded")).toBe("true");
      expect(filterBtn.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("allows toggling filter without closing settings", async () => {
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const view = await getShadowView();
    const settingsBtn = view.getByRole("button", { name: "Toggle settings" });
    const filterBtn = view.getByRole("button", { name: "Toggle filters" });

    await user.click(settingsBtn);
    await waitFor(() => expect(settingsBtn.getAttribute("aria-expanded")).toBe("true"));

    await user.click(filterBtn);
    await waitFor(() => {
      expect(filterBtn.getAttribute("aria-expanded")).toBe("true");
      expect(settingsBtn.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("allows toggling settings closed without affecting filters", async () => {
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);
    const view = await getShadowView();
    const settingsBtn = view.getByRole("button", { name: "Toggle settings" });
    const filterBtn = view.getByRole("button", { name: "Toggle filters" });

    await user.click(settingsBtn);
    await user.click(settingsBtn);
    await waitFor(() => {
      expect(settingsBtn.getAttribute("aria-expanded")).toBe("false");
      expect(filterBtn.getAttribute("aria-expanded")).toBe("false");
    });
  });
});

describe("ConvexPanel new-event badge count", () => {
  it("shows new events received while panel was closed", async () => {
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen={false} />);

    seedEvent("badge-1");
    seedEvent("badge-2");
    seedEvent("badge-3");

    await user.click((await getShadowView()).getByRole("button", { name: "Open Convex Inspect" }));
    await user.click((await getShadowView()).getByRole("button", { name: "Close Convex Inspect" }));
    await waitFor(() => expect(within(getShadowMount()).getByRole("button", { name: "Open Convex Inspect" })).toBeTruthy());

    seedEvent("badge-4");
    seedEvent("badge-5");

    const badge = await waitFor(() => within(getShadowMount()).getByLabelText("2 new events"));
    expect(badge.textContent).toBe("2");
  });

  it("hides badge when no new events have arrived since close", async () => {
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen={false} />);

    seedEvent("badge-6");

    await user.click((await getShadowView()).getByRole("button", { name: "Open Convex Inspect" }));
    await user.click((await getShadowView()).getByRole("button", { name: "Close Convex Inspect" }));
    await waitFor(() => expect(within(getShadowMount()).getByRole("button", { name: "Open Convex Inspect" })).toBeTruthy());

    expect(within(getShadowMount()).queryByLabelText(/new events/)).toBeNull();
  });
});
