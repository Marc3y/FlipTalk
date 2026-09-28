import { ArrowRight, Mic, Radio, Repeat2, Users } from "lucide-react";
import Link from "next/link";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/ui/Logo";
import { UserBadge } from "@/components/UserBadge";
import { getI18n } from "@/lib/i18n/server";
import { currentUser } from "@/lib/server/api";

const steps = [
  { icon: Users, title: "home.step1Title", body: "home.step1Body" },
  { icon: Mic, title: "home.step2Title", body: "home.step2Body" },
  { icon: Repeat2, title: "home.step3Title", body: "home.step3Body" },
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [user, { t }, { error }] = await Promise.all([currentUser(), getI18n(), searchParams]);
  return (
    <main className="app-bg min-h-dvh">
      <div className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            {user && <UserBadge user={user} />}
          </div>
        </header>

        {/* Auth.js sends failed sign-ins back here with ?error=… */}
        {error && (
          <p role="alert" className="mx-auto mt-8 max-w-md rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {t("home.authError")}
          </p>
        )}

        <section className="mt-16 text-center sm:mt-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-3 py-1 text-xs font-medium text-neon-300">
            <Radio className="size-3.5" /> {t("home.badge")}
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            {t("home.titleA")} <span className="neon-text">{t("home.titleB")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/60 sm:text-lg">
            {t("home.subtitle")}
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Link
            href="/host"
            className="glass group rounded-3xl p-6 transition hover:border-neon-500/50 hover:bg-white/[0.07] sm:p-8"
          >
            <Radio className="size-8 text-neon-400" />
            <h2 className="mt-4 font-display text-2xl font-bold">{t("home.hostTitle")}</h2>
            <p className="mt-1 text-white/60">{t("home.hostBody")}</p>
            <span className="mt-6 inline-flex items-center gap-1 font-semibold text-neon-300">
              {t("home.hostCta")} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            href="/play"
            className="glass group rounded-3xl p-6 transition hover:border-neon-500/50 hover:bg-white/[0.07] sm:p-8"
          >
            <Users className="size-8 text-fuchsia-400" />
            <h2 className="mt-4 font-display text-2xl font-bold">{t("home.joinTitle")}</h2>
            <p className="mt-1 text-white/60">{t("home.joinBody")}</p>
            <span className="mt-6 inline-flex items-center gap-1 font-semibold text-fuchsia-300">
              {t("home.joinCta")} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/30">0{i + 1}</span>
                <Icon className="size-5 text-neon-400" />
              </div>
              <h3 className="mt-3 font-semibold">{t(title)}</h3>
              <p className="mt-1 text-sm text-white/55">{t(body)}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
