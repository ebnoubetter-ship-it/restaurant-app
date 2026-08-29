"use client";

import { useTranslations } from "next-intl";

export default function LogoutButton() {
  const t = useTranslations("Common");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl border px-4 py-2 text-sm font-medium"
    >
      {t("logout")}
    </button>
  );
}