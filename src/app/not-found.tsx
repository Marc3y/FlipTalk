import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="app-bg grid min-h-dvh place-items-center px-4">
      <div className="glass max-w-sm rounded-3xl p-8 text-center">
        <p className="font-mono text-5xl font-black text-white/20">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-white/60">{t("notFound.body")}</p>
        <Link href="/play" className="mt-6 inline-block font-semibold text-neon-300 hover:underline">
          {t("notFound.cta")}
        </Link>
      </div>
    </main>
  );
}
