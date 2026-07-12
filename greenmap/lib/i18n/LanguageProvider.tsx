"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DICTS, type Dict, type Lang } from "./dictionaries";

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
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  function setLang(next: Lang) {
    setLangState(next);
    document.cookie = `greenmap-lang=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // re-render server components in the new language
  }

  return (
    <LanguageContext.Provider value={{ lang, t: DICTS[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Dictionary + switcher for Client Components. */
export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>.");
  return ctx;
}
