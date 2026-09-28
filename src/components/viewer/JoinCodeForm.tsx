"use client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";

export function JoinCodeForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const code = normalizeRoomCode(value);

  return (
    <form
      className="glass rounded-3xl p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code) return;
        setLoading(true);
        router.push(`/play/${code}`);
      }}
    >
      <h1 className="font-display text-3xl font-bold">{t("joinForm.title")}</h1>
      <p className="mt-2 text-sm text-white/60">{t("joinForm.body")}</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH))}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        placeholder="ABCDE"
        aria-label={t("joinForm.codeLabel")}
        className="mt-6 h-20 w-full rounded-2xl border border-white/10 bg-white/5 text-center font-mono text-4xl font-bold tracking-[0.4em] uppercase outline-none placeholder:text-white/15 focus:border-neon-500 focus:ring-4 focus:ring-neon-500/20"
      />
      <Button type="submit" size="lg" className="mt-4 w-full" disabled={!code} loading={loading}>
        {t("joinForm.submit")} <ArrowRight className="size-5" />
      </Button>
    </form>
  );
}
