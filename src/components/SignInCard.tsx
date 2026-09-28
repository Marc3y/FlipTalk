import { FlaskConical } from "lucide-react";
import { TwitchIcon } from "./ui/TwitchIcon";
import { signInMock, signInWithTwitch } from "@/app/actions";
import { getI18n } from "@/lib/i18n/server";

/** Server component: the Twitch button in production, a username field in local mock mode. */
export async function SignInCard({ mock, redirectTo, title, subtitle }: { mock: boolean; redirectTo: string; title: string; subtitle: string }) {
  const { t } = await getI18n();
  return (
    <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>

      {mock ? (
        <form action={signInMock} className="mt-6 space-y-3">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <FlaskConical className="size-4 shrink-0" />
            {t("signin.mockNotice")}
          </div>
          <input
            name="username"
            required
            minLength={2}
            maxLength={25}
            pattern="[A-Za-z0-9_]+"
            placeholder={t("signin.usernamePlaceholder")}
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-base outline-none placeholder:text-white/30 focus:border-neon-500 focus:ring-2 focus:ring-neon-500/30"
          />
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-neon-500 to-neon-600 font-semibold transition hover:brightness-110 active:scale-[0.98]">
            {t("signin.mockSubmit")}
          </button>
        </form>
      ) : (
        <form action={signInWithTwitch} className="mt-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-twitch text-base font-semibold shadow-[0_10px_40px_-12px_rgb(145_70_255/0.9)] transition hover:brightness-110 active:scale-[0.98]">
            <TwitchIcon />
            {t("signin.twitch")}
          </button>
          <p className="mt-3 text-center text-xs text-white/40">{t("signin.privacy")}</p>
        </form>
      )}
    </div>
  );
}
