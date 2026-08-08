"use client";

export default function LogoutButton() {
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
      Se déconnecter
    </button>
  );
}