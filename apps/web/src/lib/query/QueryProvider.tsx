"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once per browser session, never at module scope (so it is not shared between server requests).
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
