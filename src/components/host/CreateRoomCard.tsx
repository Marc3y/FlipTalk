"use client";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import { DEFAULT_MAX_PLAYERS, MAX_PLAYERS_LIMIT } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { RoomState } from "@/lib/types";

export function CreateRoomCard({ name }: { name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(DEFAULT_MAX_PLAYERS);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const room = await api<RoomState>("/api/rooms", { method: "POST", json: { maxPlayers } });
      router.push(`/host/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="glass w-full rounded-3xl p-8 text-center">
      <p className="text-sm text-white/50">{t("create.welcome", { name })}</p>
      <h1 className="mt-1 font-display text-3xl font-bold">{t("create.title")}</h1>
      <p className="mt-3 text-sm text-white/60">{t("create.body")}</p>
      <label className="mt-8 block text-left">
        <span className="flex items-baseline justify-between text-sm font-semibold">
          {t("create.maxPlayers")}
          <span className="font-mono text-2xl font-bold tabular-nums text-neon-300">{maxPlayers}</span>
        </span>
        <input
          type="range"
          min={1}
          max={MAX_PLAYERS_LIMIT}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="mt-3 w-full cursor-pointer accent-neon-400"
        />
        <span className="mt-2 block text-xs text-white/40">{t("create.maxHint", { max: MAX_PLAYERS_LIMIT })}</span>
      </label>
      <Button size="lg" className="mt-6 w-full" onClick={create} loading={loading}>
        <Sparkles className="size-5" /> {t("create.submit")}
      </Button>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
