"use client";

/**
 * Start page state on the client.
 *  - SP-2: renders instantly from a localStorage cache, then syncs with the server.
 *  - SP-6: polls the revision every 5 seconds (and on focus); refetches when it changes.
 *  - Edits update the screen first (optimistic), then save; on failure the
 *    server's version is reloaded.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { StateDTO } from "@/lib/start-page-types";
import { api } from "./api";

const POLL_MS = 5000;
const cacheKey = (userId: string) => `syncpads:state:${userId}`;

export function readCache(userId: string): StateDTO | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as StateDTO) : null;
  } catch {
    return null;
  }
}

export function clearCache(userId: string) {
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {}
}

function writeCache(userId: string, state: StateDTO) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(state));
  } catch {}
}

export function useStartPage(userId: string, onError: (message: string) => void) {
  const [state, setStateRaw] = useState<StateDTO | null>(() => readCache(userId));
  const [offline, setOffline] = useState(false);
  const stateRef = useRef(state);
  const pending = useRef(0); // writes in flight; don't let a poll overwrite them

  const setState = useCallback(
    (next: StateDTO) => {
      stateRef.current = next;
      setStateRaw(next);
      writeCache(userId, next);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    try {
      const fresh = await api<StateDTO>("GET", "/api/state");
      setOffline(false);
      if (pending.current === 0) setState(fresh);
    } catch (err) {
      if ((err as { status?: number }).status === 401) window.location.href = "/login";
      else setOffline(true);
    }
  }, [setState]);

  // Initial sync, polling, and refresh when the tab regains focus or the network returns.
  useEffect(() => {
    refresh();
    const poll = async () => {
      if (document.visibilityState !== "visible" || pending.current > 0) return;
      try {
        const { revision } = await api<{ revision: number }>("GET", "/api/state/revision");
        setOffline(false);
        if (revision !== stateRef.current?.revision) await refresh();
      } catch {
        setOffline(true);
      }
    };
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", poll);
    };
  }, [refresh]);

  /**
   * Apply `change` to the screen now, then run `request`.
   * If the server's new revision is exactly one ahead, nothing else changed
   * elsewhere, so we keep our local copy. Otherwise we reload.
   */
  const mutate = useCallback(
    async <T extends { revision: number }>(
      change: ((s: StateDTO) => StateDTO) | null,
      request: () => Promise<T>,
      afterSave?: (result: T, s: StateDTO) => StateDTO,
    ): Promise<T | null> => {
      const before = stateRef.current;
      if (!before) return null;
      if (change) setState(change(before));
      pending.current++;
      try {
        const result = await request();
        pending.current--;
        const current = stateRef.current ?? before;
        const updated = afterSave ? afterSave(result, current) : current;
        // A write with no local change (e.g. creating a group) must reload,
        // otherwise the new revision would hide the new data from us.
        const knowsResult = change !== null || afterSave !== undefined;
        if (knowsResult && result.revision === before.revision + 1 && pending.current === 0) {
          setState({ ...updated, revision: result.revision });
        } else {
          setState(updated);
          if (pending.current === 0) await refresh();
        }
        return result;
      } catch (err) {
        pending.current--;
        onError((err as Error).message);
        await refresh();
        return null;
      }
    },
    [onError, refresh, setState],
  );

  return { state, offline, refresh, mutate };
}

