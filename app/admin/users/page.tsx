"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  role: "admin" | "cashier" | "stock_manager";
  pin_defined: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("cashier");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    const response = await fetch("/api/users");
    const data = await response.json();

    if (response.ok) {
      setUsers(data);
    }
  };

  const resetPin = async (userId: string, userName: string) => {
    const confirmed = window.confirm(
        `Réinitialiser le PIN de ${userName} ?`
    );

    if (!confirmed) return;

    const response = await fetch(
        `/api/users/${userId}/reset-pin`,
        {
        method: "POST",
        }
    );

    const data = await response.json();

    if (!response.ok) {
        setMessage(
        data.error || "Impossible de réinitialiser le PIN."
        );
        return;
    }

    setMessage(`PIN de ${userName} réinitialisé.`);
    await loadUsers();
    };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async () => {
    if (!name.trim()) {
      setMessage("Veuillez saisir un nom.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        role,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    setName("");
    setRole("cashier");
    setMessage("Utilisateur créé avec succès.");
    await loadUsers();
    setLoading(false);
  };

  const roleLabel = (role: User["role"]) => {
    if (role === "admin") return "Admin";
    if (role === "cashier") return "Caissier";
    return "Gérant de stock";
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="mt-2 text-slate-500">
            Créez les accès des employés du restaurant.
          </p>
        </div>

        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold">
            Ajouter un utilisateur
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Nom de l'employé"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border px-4 py-3"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="cashier">Caissier</option>
              <option value="stock_manager">
                Gérant de stock
              </option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            onClick={createUser}
            disabled={loading}
            className="mt-4 rounded-xl bg-sky-500 px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer l'utilisateur"}
          </button>

          {message && (
            <p className="mt-4 text-sm text-slate-600">
              {message}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold">
            Équipe
          </h2>

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-slate-500">
                    {roleLabel(user.role)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                    <div
                        className={
                        user.pin_defined
                            ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                            : "rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700"
                        }
                    >
                        {user.pin_defined
                        ? "PIN défini"
                        : "PIN à créer"}
                    </div>

                    {user.pin_defined && (
                        <button
                        onClick={() => resetPin(user.id, user.name)}
                        className="rounded-lg border px-3 py-2 text-sm"
                        >
                        Réinitialiser le PIN
                        </button>
                    )}
                    </div>
              </div>
            ))}

            {users.length === 0 && (
              <p className="text-slate-500">
                Aucun utilisateur.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}