"use client";

export type AppLanguage = "es-mx" | "en-us";
export const LANGUAGE_EVENT = "lolparty:language-change";
const LANGUAGE_KEY = "lolparty:language";

export function getLanguage(): AppLanguage {
  if (typeof window === "undefined") return "es-mx";
  return window.localStorage.getItem(LANGUAGE_KEY) === "en-us" ? "en-us" : "es-mx";
}

export function setLanguage(language: AppLanguage): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LANGUAGE_KEY, language); } catch { /* almacenamiento bloqueado */ }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}
