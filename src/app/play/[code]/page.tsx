import { RefreshCw, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SignInCard } from "@/components/SignInCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/ui/Logo";
import { ViewerView } from "@/components/viewer/ViewerView";
import { DEFAULT_MAX_PLAYERS, normalizeRoomCode } from "@/lib/constants";
import { getI18n } from "@/lib/i18n/server";
import { currentUser } from "@/lib/server/api";
import { isMockAuth } from "@/lib/server/env";
import { roomSocketToken } from "@/lib/server/realtime";
import { getMe, getRoomState } from "@/lib/server/rooms";

export default async function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) notFound();
  const [user, state] = await Promise.all([currentUser(), getRoomState(code)]);
  if (!state) notFound();

  if (!user) {
    const { t } = await getI18n();
    const max = state.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    // Full room: say so before the Twitch login. Saves the visitor the detour and us the OAuth
    // round trip (sign-in action, callback, second page render) for someone who can't get in anyway.
    const full = state.memberCount >= max || state.phase === "closed";
    return (
      <main className="app-bg flex min-h-dvh flex-col px-4 pt-6">
        <header className="mx-auto flex w-full max-w-md items-center justify-between">
          <Logo />
          <LanguageSwitch />
        </header>
        <div className="mx-auto mt-16 w-full max-w-md">
          {full ? (
            <div className="glass rounded-3xl p-8 text-center">
              <UsersRound className="mx-auto size-10 text-amber-300" />
              <h1 className="mt-4 font-display text-2xl font-bold">
                {state.phase === "closed" ? t("viewer.closedTitle") : t("viewer.fullTitle")}
              </h1>
              <p className="mt-2 text-sm text-white/60">
                {state.phase === "closed" ? t("viewer.closedBody") : t("viewer.fullBody", { max })}
              </p>
              {state.phase !== "closed" && (
                // Plain reload: one page render, and the login appears as soon as a slot is free.
                <a
                  href={`/play/${code}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <RefreshCw className="size-4" /> {t("viewer.fullRetry")}
                </a>
              )}
            </div>
          ) : (
            <SignInCard
              mock={isMockAuth}
              redirectTo={`/play/${code}`}
              title={t("signin.joinTitle", { name: state.host.name })}
              subtitle={t("signin.joinSubtitle")}
            />
          )}
        </div>
      </main>
    );
  }
  if (state.host.id === user.id) redirect(`/host/${code}`);

  // The token names the user, so the worker can tell the host who is actually on the page.
  return <ViewerView initial={state} initialMe={await getMe(code, user, state)} token={roomSocketToken(code, user.id)} />;
}
