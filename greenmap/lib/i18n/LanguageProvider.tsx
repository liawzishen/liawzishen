"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRefreshData } from "@/lib/router/refresh";
import { DICTS, LANG_COOKIE, type Dict, type Lang } from "./dictionaries";

/**
 * Client side of the cookie-based locale. The root layout (server) reads the
 * cookie and seeds `initialLang`, so the first paint is already in the right
 * language — no flash. `setLang` persists the cookie for a year and refreshes
 * the route so Server Components re-render in the new language too.
 */

const LanguageContext = createContext<{
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
} | null>(null);

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const refreshData = useRefreshData();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      // Re-render server components in the new language, and drop every
      // kept page (they were rendered in the old one).
      refreshData();
    },
    [refreshData]
  );

  // Memoised so the ~50 client components reading this context re-render only
  // when the language changes, not on every render of the root layout.
  const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/** Dictionary + switcher for Client Components. */
export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>.");
  return ctx;
}
