import { notFound, redirect } from "next/navigation";
import { SignInCard } from "@/components/SignInCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/ui/Logo";
import { ViewerView } from "@/components/viewer/ViewerView";
import { normalizeRoomCode } from "@/lib/constants";
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
    return (
      <main className="app-bg flex min-h-dvh flex-col px-4 pt-6">
        <header className="mx-auto flex w-full max-w-md items-center justify-between">
          <Logo />
          <LanguageSwitch />
        </header>
        <div className="mx-auto mt-16 w-full max-w-md">
          <SignInCard
            mock={isMockAuth}
            redirectTo={`/play/${code}`}
            title={t("signin.joinTitle", { name: state.host.name })}
            subtitle={t("signin.joinSubtitle")}
          />
        </div>
      </main>
    );
  }
  if (state.host.id === user.id) redirect(`/host/${code}`);

  // The token names the user, so the worker can tell the host who is actually on the page.
  return <ViewerView initial={state} initialMe={await getMe(code, user, state)} token={roomSocketToken(code, user.id)} />;
}
