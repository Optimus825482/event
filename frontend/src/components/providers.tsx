"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBoundary } from "./error-boundary";
import { SmartGuide } from "./ui/SmartGuide";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 dakika
            refetchOnWindowFocus: false,
            retry: 2,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
        <SmartGuide />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
