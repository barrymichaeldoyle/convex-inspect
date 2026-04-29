import { useCallback, useEffect, useRef } from "react";
import { useAction as convexUseAction, useMutation as convexUseMutation, useQuery as convexUseQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";
import { isDevEnvironment } from "./env.js";
import { convexPanelBus, createEventId, extractError, getFnName } from "./index.js";

function serializeArgs(args: unknown) {
  try {
    return JSON.stringify(args ?? null);
  } catch {
    return "[unserializable]";
  }
}

export function useQuery<Query extends FunctionReference<"query">>(
  query: Query | "skip",
  ...args: OptionalRestArgs<Query>
): FunctionReturnType<Query> | undefined {
  const result = convexUseQuery(query as Query, ...args);

  const idRef = useRef(createEventId());
  const startedAtRef = useRef(Date.now());
  const prevQueryKeyRef = useRef<string | undefined>(undefined);

  const name = getFnName(query);
  const queryKey = query === "skip" ? "skip" : `${name}:${serializeArgs(args[0])}`;

  if (prevQueryKeyRef.current !== undefined && prevQueryKeyRef.current !== queryKey) {
    idRef.current = createEventId();
    startedAtRef.current = Date.now();
  }
  prevQueryKeyRef.current = queryKey;

  const id = idRef.current;
  const startedAt = startedAtRef.current;

  useEffect(() => {
    if (!isDevEnvironment() || query === "skip") return;
    convexPanelBus.emit({ id, type: "query", name, args: args[0] ?? {}, status: "loading", startedAt });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    if (!isDevEnvironment() || result === undefined || query === "skip") return;
    convexPanelBus.emit({ id, type: "query", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, queryKey, id]);

  return result;
}

export function useMutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation) {
  const originalFn = convexUseMutation(mutation);
  const name = getFnName(mutation);

  return useCallback(
    async (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      if (!isDevEnvironment()) return originalFn(...args);

      const id = createEventId();
      const startedAt = Date.now();
      convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "loading", startedAt });
      try {
        const result = await originalFn(...args);
        convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
        return result;
      } catch (err) {
        convexPanelBus.emit({ id, type: "mutation", name, args: args[0] ?? {}, status: "error", ...extractError(err), startedAt, completedAt: Date.now() });
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
      if (!isDevEnvironment()) return originalFn(...args);

      const id = createEventId();
      const startedAt = Date.now();
      convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "loading", startedAt });
      try {
        const result = await originalFn(...args);
        convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "success", result, startedAt, completedAt: Date.now() });
        return result;
      } catch (err) {
        convexPanelBus.emit({ id, type: "action", name, args: args[0] ?? {}, status: "error", ...extractError(err), startedAt, completedAt: Date.now() });
        throw err;
      }
    },
    [originalFn, name],
  );
}
