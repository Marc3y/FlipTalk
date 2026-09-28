"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { formatNumber, LANG_COOKIE, translate, type Lang, type MessageKey, type MessageParams } from "./messages";

const I18nContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void } | null>(null);

/** The server passes the language from the cookie, so the first render is already translated. */
export function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState(initial);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      router.refresh(); // re-render server components in the new language
    },
    [router],
  );

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  const { lang, setLang } = ctx;
  const t = useCallback((key: MessageKey, params?: MessageParams) => translate(lang, key, params), [lang]);
  const fmt = useCallback((n: number) => formatNumber(lang, n), [lang]);
  return { lang, setLang, t, fmt };
}
