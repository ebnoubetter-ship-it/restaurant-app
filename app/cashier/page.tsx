"use client";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

type TableStatus = "available" | "reserved" | "occupied";

type RestaurantTable = {
  id: string;
  name: string;
  zone: "VIP" | "Terrasse" | "Salle";
  status: TableStatus;
};

export default function CashierPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] =
  useState<RestaurantTable | null>(null);

  useEffect(() => {
    const loadTables = async () => {
      const response = await fetch("/api/tables");
      const data = await response.json();

      if (response.ok) {
        setTables(data);
      }

      setLoading(false);
    };

    loadTables();
  }, []);

  const getStatusStyle = (status: TableStatus) => {
    if (status === "occupied") {
      return "border-red-300 bg-red-100 text-red-700";
    }

    if (status === "reserved") {
      return "border-orange-300 bg-orange-100 text-orange-700";
    }

    return "border-green-300 bg-green-100 text-green-700";
  };

  const getStatusLabel = (status: TableStatus) => {
    if (status === "occupied") return "Occupée";
    if (status === "reserved") return "Réservée";

    return "Disponible";
  };

  const renderZone = (
    title: string,
    zone: RestaurantTable["zone"]
  ) => {
    const zoneTables = tables.filter(
      (table) => table.zone === zone
    );

    return (
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">
          {title}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {zoneTables.map((table) => (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`min-h-24 rounded-2xl border p-4 text-left transition hover:scale-[1.02] ${getStatusStyle(
                table.status
              )}`}
            >
              <p className="font-semibold">
                {table.name}
              </p>

              <p className="mt-2 text-sm">
                {getStatusLabel(table.status)}
              </p>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const available = tables.filter(
    (table) => table.status === "available"
  ).length;

  const reserved = tables.filter(
    (table) => table.status === "reserved"
  ).length;

  const occupied = tables.filter(
    (table) => table.status === "occupied"
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Chargement des tables...
      </main>
    );
  }
  const updateTableStatus = async (
  tableId: string,
  status: TableStatus
) => {
  const response = await fetch(
    `/api/tables/${tableId}/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Une erreur est survenue.");
    return;
  }

  setTables((currentTables) =>
    currentTables.map((table) =>
      table.id === tableId
        ? { ...table, status: data.status }
        : table
    )
  );

  setSelectedTable(null);
};

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Espace caissier
            </p>

            <h1 className="text-3xl font-bold">
              Tables
            </h1>
          </div>

          <LogoutButton />
        </header>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Disponibles
            </p>

            <p className="mt-1 text-2xl font-bold text-green-600">
              {available}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Réservées
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-500">
              {reserved}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Occupées
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {occupied}
            </p>
          </div>
        </div>

        {renderZone("VIP", "VIP")}
        {renderZone("Box Terrasse", "Terrasse")}
        {renderZone("Salle", "Salle")}
      </div>
      {selectedTable && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="text-xl font-bold">
        {selectedTable.name}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {getStatusLabel(selectedTable.status)}
      </p>

      {selectedTable.status === "available" && (
        <div className="mt-6 space-y-3">
          <button
            onClick={() =>
              updateTableStatus(
                selectedTable.id,
                "reserved"
              )
            }
            className="w-full rounded-xl bg-orange-500 py-3 font-medium text-white"
          >
            Réserver la table
          </button>

          <button
            onClick={() =>
              updateTableStatus(
                selectedTable.id,
                "occupied"
              )
            }
            className="w-full rounded-xl bg-red-500 py-3 font-medium text-white"
          >
            Ouvrir une commande
          </button>
        </div>
      )}

      {selectedTable.status === "reserved" && (
        <div className="mt-6 space-y-3">
          <button
            onClick={() =>
              updateTableStatus(
                selectedTable.id,
                "occupied"
              )
            }
            className="w-full rounded-xl bg-red-500 py-3 font-medium text-white"
          >
            Client arrivé
          </button>

          <button
            onClick={() =>
              updateTableStatus(
                selectedTable.id,
                "available"
              )
            }
            className="w-full rounded-xl border py-3 font-medium"
          >
            Annuler la réservation
          </button>
        </div>
      )}

      {selectedTable.status === "occupied" && (
        <div className="mt-6">
          <button
            className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white"
          >
            Voir la commande
          </button>
        </div>
      )}

      <button
        onClick={() => setSelectedTable(null)}
        className="mt-4 w-full py-2 text-sm text-slate-500"
      >
        Fermer
      </button>
    </div>
  </div>
)}
    </main>
  );
}