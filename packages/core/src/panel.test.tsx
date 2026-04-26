// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexPanel } from "./panel.js";
import { convexPanelBus } from "./index.js";

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
  convexPanelBus.clear();
  localStorage.clear();
});

describe("ConvexPanel accessibility", () => {
  it("supports keyboard expansion and collapse on event rows", async () => {
    seedEvent("event-1");
    const user = userEvent.setup();
    const { container } = render(<ConvexPanel defaultOpen />);

    const rowSummary = container.querySelector('[aria-controls="convex-panel-detail-event-1"]');
    if (!(rowSummary instanceof HTMLDivElement)) {
      throw new Error("Expected row summary button to exist");
    }

    expect(rowSummary.getAttribute("role")).toBe("button");
    expect(rowSummary.getAttribute("tabindex")).toBe("0");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("false");

    rowSummary.focus();
    await user.keyboard("{Enter}");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("true");
    screen.getByText("Args");

    await user.keyboard(" ");
    expect(rowSummary.getAttribute("aria-expanded")).toBe("false");
  });

  it("removes collapsed detail actions from the accessibility tree", async () => {
    seedEvent("event-2", "tasks:delete");
    const user = userEvent.setup();
    const { container } = render(<ConvexPanel defaultOpen />);

    const rowSummary = container.querySelector('[aria-controls="convex-panel-detail-event-2"]');
    if (!(rowSummary instanceof HTMLDivElement)) {
      throw new Error("Expected row summary button to exist");
    }

    expect(screen.queryByRole("button", { name: "Copy Args" })).toBeNull();

    await user.click(rowSummary);
    screen.getByRole("button", { name: "Copy Args" });

    await user.click(rowSummary);
    expect(screen.queryByRole("button", { name: "Copy Args" })).toBeNull();
  });

  it("keeps collapsed detail actions out of tab order while row summaries remain focusable", async () => {
    seedEvent("event-3", "tasks:list");
    const user = userEvent.setup();
    render(<ConvexPanel defaultOpen />);

    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Clear events");

    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Toggle settings");

    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Toggle filters");

    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close Convex Panel");

    await user.tab();
    expect(document.activeElement?.getAttribute("role")).toBe("button");
    expect(document.activeElement?.getAttribute("aria-controls")).toBe("convex-panel-detail-event-3");

    expect(screen.queryByRole("button", { name: "Copy Args" })).toBeNull();
  });
});
