import { notFound } from "next/navigation";
import { Overlay } from "@/components/Overlay";
import { normalizeRoomCode } from "@/lib/constants";
import { I18nProvider } from "@/lib/i18n/client";
import { isLang } from "@/lib/i18n/messages";
import { getLang } from "@/lib/i18n/server";
import { roomSocketToken } from "@/lib/server/realtime";
import { getRoomState } from "@/lib/server/rooms";

export const metadata = { title: "Overlay" };

/**
 * Read-only, transparent view for an OBS browser source (e.g. 1920×1080). No login needed.
 * OBS keeps its own cookies, so `?lang=de|en` (added by the host's copy button) sets the language.
 */
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const code = normalizeRoomCode((await params).code);
  const requested = (await searchParams).lang;
  const lang = isLang(requested) ? requested : await getLang();
  const state = code ? await getRoomState(code) : null;
  if (!state) notFound();
  return (
    <I18nProvider lang={lang} fixed>
      <Overlay initial={state} token={roomSocketToken(state.code)} />
    </I18nProvider>
  );
}
