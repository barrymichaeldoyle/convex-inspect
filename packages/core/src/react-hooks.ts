import { useCallback, useEffect, useRef } from "react";
import { useAction as convexUseAction, useMutation as convexUseMutation, useQuery as convexUseQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";
import { convexPanelBus, createEventId, getFnName } from "./index.js";

function isDevMode() {
  return typeof process === "undefined" || process.env.NODE_ENV !== "production";
}

export function useQuery<Query extends FunctionReference<"query">>(
  query: Query | "skip",
  ...args: OptionalRestArgs<Query>
): FunctionReturnType<Query> | undefined {
  const result = convexUseQuery(query as Query, ...args);

  const idRef = useRef(createEventId());
  const startedAtRef = useRef(Date.now());
  const prevArgsKeyRef = useRef<string | undefined>(undefined);

  const name = getFnName(query);
  const argsKey = query === "skip" ? "skip" : JSON.stringify(args[0] ?? null);

  if (prevArgsKeyRef.current !== undefined && prevArgsKeyRef.current !== argsKey) {
    idRef.current = createEventId();
    startedAtRef.current = Date.now();
  }
  prevArgsKeyRef.current = argsKey;

  const id = idRef.current;
  const startedAt = startedAtRef.current;

  useEffect(() => {
    if (!isDevMode() || query === "skip") return;
    convexPanelBus.emit({ id, type: "query", name, args: args[0] ?? {}, status: "loading", startedAt });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argsKey]);

  useEffect(() => {
    if (!isDevMode() || result === undefined || query === "skip") return;
    convexPanelBus.emit({ id, type: "query", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, id]);

  return result;
}

export function useMutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation) {
  const originalFn = convexUseMutation(mutation);
  const name = getFnName(mutation);

  return useCallback(
    async (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      if (!isDevMode()) return originalFn(...args);

      const id = createEventId();
      const startedAt = Date.now();
      convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "loading", startedAt });
      try {
        const result = await originalFn(...args);
        convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
        return result;
      } catch (err) {
        convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "error", error: String(err), startedAt, completedAt: Date.now() });
        throw err;
      }
    },
    [originalFn, name],
  );
}

export function useAction<Action extends FunctionReference<"action">>(action: Action) {
  const originalFn = convexUseAction(action);
  const name = getFnName(action);

  return useCallback(
    async (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>> => {
      if (!isDevMode()) return originalFn(...args);

      const id = createEventId();
      const startedAt = Date.now();
      convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "loading", startedAt });
      try {
        const result = await originalFn(...args);
        convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
        return result;
      } catch (err) {
        convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "error", error: String(err), startedAt, completedAt: Date.now() });
        throw err;
      }
    },
    [originalFn, name],
  );
}
