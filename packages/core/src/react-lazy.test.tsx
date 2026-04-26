// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { ConvexPanel } from "./react-lazy.js";

function getShadowMount() {
  const hosts = document.body.querySelectorAll("[data-convex-panel-host]");
  const host = hosts[hosts.length - 1];
  if (!(host instanceof HTMLElement) || !host.shadowRoot) {
    throw new Error("Expected ConvexPanel shadow host");
  }
  const mount = host.shadowRoot.querySelector("[data-convex-panel-mount]");
  if (!(mount instanceof HTMLElement)) {
    throw new Error("Expected ConvexPanel shadow mount");
  }
  return mount;
}

beforeEach(() => {
  cleanup();
  globalThis.__CONVEX_INSPECT_DEV__ = false;
});

afterEach(() => {
  delete globalThis.__CONVEX_INSPECT_DEV__;
});

describe("ConvexPanel lazy entry", () => {
  it("does not render the panel when devtools are disabled", () => {
    render(<ConvexPanel defaultOpen />);
    expect(document.body.querySelector("[data-convex-panel-host]")).toBeNull();
  });

  it("renders the panel when explicitly enabled via prop", async () => {
    render(<ConvexPanel defaultOpen enabled />);
    await waitFor(() => expect(getShadowMount()).toBeTruthy());
    expect(within(getShadowMount()).getByRole("dialog", { name: "Convex Inspect" })).toBeTruthy();
  });
});
