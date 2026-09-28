"use client";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LANGS } from "@/lib/i18n/messages";

/** Small DE | EN toggle. Remembered in a cookie; German is the default. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("lang.label")} className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 ${className}`}>
      <Languages className="ml-1.5 size-3.5 text-white/35" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider transition ${
            lang === l ? "bg-white/15 text-white" : "text-white/40 hover:text-white/80"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
