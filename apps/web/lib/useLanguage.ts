"use client";

import { useEffect, useState } from "react";
import { getLanguage, LANGUAGE_EVENT, type AppLanguage } from "./language";

export function useLanguage(): AppLanguage {
  const [language, setLanguage] = useState<AppLanguage>("es-mx");

  useEffect(() => {
    const sync = () => setLanguage(getLanguage());
    sync();
    window.addEventListener(LANGUAGE_EVENT, sync);
    return () => window.removeEventListener(LANGUAGE_EVENT, sync);
  }, []);

  return language;
}
