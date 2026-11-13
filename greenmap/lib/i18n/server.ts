import { cookies } from "next/headers";
import { DICTS, LANG_COOKIE, isLang, type Dict, type Lang } from "./dictionaries";

/** Current UI language for Server Components / route handlers (cookie). */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

/** The dictionary for the current request. */
export async function getDict(): Promise<Dict> {
  return DICTS[await getLang()];
}
