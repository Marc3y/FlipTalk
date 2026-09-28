import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANG, formatNumber, isLang, LANG_COOKIE, translate, type Lang, type MessageKey, type MessageParams } from "./messages";

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

/** For server components: `const { t } = await getI18n()`. */
export async function getI18n(forced?: Lang) {
  const lang = forced ?? (await getLang());
  return {
    lang,
    t: (key: MessageKey, params?: MessageParams) => translate(lang, key, params),
    fmt: (n: number) => formatNumber(lang, n),
  };
}
