import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
            <p className="mt-1 text-slate-500">
              Gestion du restaurant
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/users"
            className="rounded-2xl bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold">Utilisateurs</h2>
            <p className="mt-2 text-sm text-slate-500">
              Créer et gérer les accès des employés.
            </p>
          </Link>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Tables</h2>
            <p className="mt-2 text-sm text-slate-500">
              Vue des tables et de leur statut.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Ventes</h2>
            <p className="mt-2 text-sm text-slate-500">
              Suivi des ventes et paiements.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Stock</h2>
            <p className="mt-2 text-sm text-slate-500">
              Consultation des stocks et alertes.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Rapports</h2>
            <p className="mt-2 text-sm text-slate-500">
              Historique et indicateurs.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}