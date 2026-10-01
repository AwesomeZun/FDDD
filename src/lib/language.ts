export type Language = "en" | "ko";
/** Explicit routes win; otherwise retain an intentional choice and default to English. */
export function resolveLanguage(
  pathname: string,
  stored: string | null,
): Language {
  if (/^\/en(?:\/|$)/.test(pathname)) return "en";
  if (/^\/ko(?:\/|$)/.test(pathname)) return "ko";
  return stored === "ko" ? "ko" : "en";
}
