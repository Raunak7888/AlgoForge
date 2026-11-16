"use client";

import { useEffect, useRef } from "react";
import type { WorkspaceDraft } from "@algoforge/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth";
import { loadDraft, saveDraft, type LocalDraft } from "./draft-storage";
import { useWorkspace } from "./store";

const LOCAL_DEBOUNCE_MS = 400;
const SERVER_DEBOUNCE_MS = 2500;

/** draftAt of the last restored draft. A restore is not an edit, so it must not be saved again. */
let restoredAt: number | null = null;

function snapshot(): LocalDraft | null {
  const s = useWorkspace.getState();
  return s.draftAt === null ? null : { language: s.language, codes: s.codes, updatedAt: s.draftAt };
}

function restore(d: LocalDraft): void {
  restoredAt = d.updatedAt;
  useWorkspace.getState().restoreDraft(d);
}

function adopt(d: WorkspaceDraft): void {
  const at = Date.parse(d.updatedAt);
  restore({ language: d.language, codes: d.codes, updatedAt: at });
  saveDraft({ language: d.language, codes: d.codes, updatedAt: at });
}

async function pushToServer(): Promise<void> {
  const snap = snapshot();
  if (!snap) return;
  try {
    const res = await endpoints.saveWorkspaceDraft({ language: snap.language, codes: snap.codes, updatedAt: new Date(snap.updatedAt).toISOString() });
    // Another device saved something newer: take it, unless the person kept typing meanwhile.
    if (!res.applied && Date.parse(res.draft.updatedAt) > snap.updatedAt && useWorkspace.getState().draftAt === snap.updatedAt) adopt(res.draft);
  } catch {
    /* offline, too large or signed out: the browser copy still exists */
  }
}

/**
 * Keeps the editor content across refreshes.
 *  - Everyone: a copy in this browser (localStorage).
 *  - Signed in: also a copy on the server, so it follows the person between devices.
 * The newest edit wins; a restore never replaces something typed after the page loaded.
 */
export function useWorkspaceDraft(): void {
  const { status } = useAuth();
  const authed = status === "authed";
  const authedRef = useRef(authed);
  useEffect(() => {
    authedRef.current = authed;
  });

  // 1. Restore the browser copy, but only if nothing was edited or opened yet.
  useEffect(() => {
    const d = loadDraft();
    if (d && useWorkspace.getState().draftAt === null) restore(d);
  }, []);

  // 2. Signed in: reconcile with the server copy. Newer wins in both directions.
  useEffect(() => {
    if (!authed) return;
    const ctl = new AbortController();
    endpoints
      .workspaceDraft(ctl.signal)
      .then(({ draft }) => {
        const local = useWorkspace.getState().draftAt ?? 0;
        const remote = draft ? Date.parse(draft.updatedAt) : 0;
        if (draft && remote > local) adopt(draft);
        else if (local > remote) void pushToServer();
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [authed]);

  // 3. Autosave edits.
  useEffect(() => {
    let localTimer: ReturnType<typeof setTimeout> | undefined;
    let serverTimer: ReturnType<typeof setTimeout> | undefined;
    let localDirty = false;
    let serverDirty = false;

    const flushLocal = () => {
      clearTimeout(localTimer);
      if (!localDirty) return;
      localDirty = false;
      const snap = snapshot();
      if (snap) saveDraft(snap);
    };
    const flushServer = () => {
      clearTimeout(serverTimer);
      if (!serverDirty || !authedRef.current) return;
      serverDirty = false;
      void pushToServer();
    };

    const unsubscribe = useWorkspace.subscribe((s, prev) => {
      if (s.draftAt === null || s.draftAt === prev.draftAt || s.draftAt === restoredAt) return;
      localDirty = true;
      clearTimeout(localTimer);
      localTimer = setTimeout(flushLocal, LOCAL_DEBOUNCE_MS);
      if (authedRef.current) {
        serverDirty = true;
        clearTimeout(serverTimer);
        serverTimer = setTimeout(flushServer, SERVER_DEBOUNCE_MS);
      }
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") flushLocal();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushLocal);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushLocal);
      flushLocal();
      flushServer();
    };
  }, []);
}
