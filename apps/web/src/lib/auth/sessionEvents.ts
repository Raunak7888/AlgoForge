type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "the session could not be recovered" (a 401 that a refresh did not fix). Returns the unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of [...listeners]) listener();
}
