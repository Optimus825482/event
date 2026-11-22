"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

const NonceContext = createContext<string | undefined>(undefined);

/** Proxy'nin ürettiği CSP nonce'unu satır içi `<style>`/`<script>` üreten istemci bileşenlerine (Radix vb.) taşır. */
export function NonceProvider({ nonce, children }: { nonce: string | undefined; children: ReactNode }) {
  // `react-style-singleton` (Radix diyalog/menü kaydırma kilidi) `<style>` basarken nonce'u buradan okur.
  useEffect(() => {
    if (nonce) Object.assign(globalThis, { __webpack_nonce__: nonce });
  }, [nonce]);
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
