import { SignInCard } from "@/components/SignInCard";
import { CreateRoomCard } from "@/components/host/CreateRoomCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/ui/Logo";
import { UserBadge } from "@/components/UserBadge";
import { getI18n } from "@/lib/i18n/server";
import { currentUser } from "@/lib/server/api";
import { isMockAuth } from "@/lib/server/env";

export const metadata = { title: "Host" };

export default async function HostPage() {
  const [user, { t }] = await Promise.all([currentUser(), getI18n()]);
  return (
    <main className="app-bg min-h-dvh px-4 pt-6 sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          {user && <UserBadge user={user} />}
        </div>
      </header>
      <div className="mx-auto mt-20 flex max-w-md justify-center">
        {user ? (
          <CreateRoomCard name={user.name} />
        ) : (
          <SignInCard
            mock={isMockAuth}
            redirectTo="/host"
            title={t("signin.hostTitle")}
            subtitle={t("signin.hostSubtitle")}
          />
        )}
      </div>
    </main>
  );
}
