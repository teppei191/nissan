"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/types";

type LocaleState = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "ja",
      setLocale: (l) => set({ locale: l }),
    }),
    { name: "dt-hub-locale" }
  )
);
