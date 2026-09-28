"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { RoomState } from "@/lib/types";
import { Avatar } from "./ui/Avatar";

export function LastResult({ result }: { result: RoomState["lastResult"] }) {
  const { t } = useI18n();
  return (
    <AnimatePresence mode="wait">
      {result && (
        <motion.div
          key={result.round}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className={`glass flex items-center gap-3 rounded-2xl p-4 ${result.verdict === "nailed" ? "border-emerald-400/30" : "border-rose-400/30"}`}
        >
          <Avatar player={result.player} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/40">{t("result.round", { n: result.round })}</p>
            <p className="truncate text-sm font-semibold">{t("result.clip", { name: result.player.name })}</p>
          </div>
          {result.verdict === "nailed" ? (
            <span className="flex items-center gap-1 text-sm font-bold text-emerald-300">
              <Trophy className="size-4" /> {t("result.nailed")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-bold text-rose-300">
              <XCircle className="size-4" /> {t("result.failed")}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
