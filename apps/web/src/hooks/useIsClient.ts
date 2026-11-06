import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false on the server and during hydration, true on the client afterwards. */
export const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);
