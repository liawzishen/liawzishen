"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LANGS } from "@/lib/i18n/dictionaries";

/**
 * Language row for the profile/settings screens — a segmented English /
 * Bahasa Melayu switch. The choice is stored in a device cookie and applied
 * instantly (client context + a router refresh for server components).
 */
export function LanguageSetting() {
  const { lang, t, setLang } = useI18n();

  return (
    <div className="rounded-card p-4 glass">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium">🌐 {t.profile.language}</p>
          <p className="mt-0.5 text-[12px] text-secondary">
            {t.profile.languageHint}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-fill p-1">
          {LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLang(l.value)}
              aria-pressed={lang === l.value}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                lang === l.value
                  ? "bg-brand text-white"
                  : "text-secondary active:opacity-70"
              }`}
            >
              {l.value === "en" ? "EN" : "BM"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
