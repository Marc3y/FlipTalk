"use client";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import type { RoomState } from "@/lib/types";

export function CreateRoomCard({ name }: { name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const room = await api<RoomState>("/api/rooms", { method: "POST" });
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
      <Button size="lg" className="mt-8 w-full" onClick={create} loading={loading}>
        <Sparkles className="size-5" /> {t("create.submit")}
      </Button>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
