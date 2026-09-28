"use client";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import type { PublicPlayer } from "@/lib/types";
import { Avatar } from "./ui/Avatar";

export function UserBadge({ user }: { user: PublicPlayer }) {
  const { t } = useI18n();
  return (
    <form action={signOutAction} className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-2">
      <Avatar player={user} size="sm" />
      <span className="max-w-28 truncate text-sm font-medium">{user.name}</span>
      <button title={t("user.signOut")} className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
        <LogOut className="size-4" />
      </button>
    </form>
  );
}
