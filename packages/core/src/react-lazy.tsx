import { Suspense, lazy, type ComponentType } from "react";
import type { ConvexPanelProps } from "./panel.js";

const LazyPanel = lazy<ComponentType<ConvexPanelProps>>(async () => {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return { default: (() => null) as ComponentType<ConvexPanelProps> };
  }

  const mod = await import("./panel.js");
  return { default: mod.ConvexPanel as ComponentType<ConvexPanelProps> };
});

export function ConvexPanel(props: ConvexPanelProps) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyPanel {...props} />
    </Suspense>
  );
}

export { useAction, useMutation, useQuery } from "./react-hooks.js";
export { convexPanelBus } from "./index.js";
export type { ConvexPanelProps } from "./panel.js";
