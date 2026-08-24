"use client";

import { useTransition } from "react";

type Locale = "fr" | "ar";

export default function LanguageSwitcher({
  locale,
}: {
  locale: Locale;
}) {
  const [
    isPending,
    startTransition,
  ] = useTransition();

  const changeLocale = (
    nextLocale: Locale
  ) => {
    if (
      nextLocale === locale
    ) {
      return;
    }

    document.cookie =
      `maida_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;

    startTransition(() => {
      window.location.reload();
    });
  };

  return (
    <div className="inline-flex rounded-xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() =>
          changeLocale("fr")
        }
        disabled={
          isPending
        }
        className={
          locale === "fr"
            ? "rounded-lg bg-[#1E4D3A] px-3 py-2 text-sm font-semibold text-white"
            : "rounded-lg px-3 py-2 text-sm font-semibold text-[#68706B] hover:bg-[#F5F4F0]"
        }
      >
        Français
      </button>

      <button
        type="button"
        onClick={() =>
          changeLocale("ar")
        }
        disabled={
          isPending
        }
        className={
          locale === "ar"
            ? "rounded-lg bg-[#1E4D3A] px-3 py-2 text-sm font-semibold text-white"
            : "rounded-lg px-3 py-2 text-sm font-semibold text-[#68706B] hover:bg-[#F5F4F0]"
        }
      >
        العربية
      </button>
    </div>
  );
}