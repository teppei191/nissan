"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocale } from "@/stores/locale";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );
  const [mockReady, setMockReady] = useState(false);
  const locale = useLocale((s) => s.locale);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { worker } = await import("@/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass", quiet: true });
      if (!cancelled) setMockReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch all queries whenever locale changes — server-rendered text
  // (agent descriptions, seed messages, AI replies, feedback comments)
  // should switch language without a manual reload.
  useEffect(() => {
    client.invalidateQueries();
  }, [locale, client]);

  if (!mockReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-[var(--text-tertiary)] text-sm">Initializing mock service worker...</div>
      </div>
    );
  }
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
