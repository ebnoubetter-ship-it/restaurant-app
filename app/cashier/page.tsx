"use client";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";

type TableStatus =
  | "available"
  | "reserved"
  | "occupied";

type RestaurantTable = {
  id: string;
  name: string;
  zone: "VIP" | "Terrasse" | "Salle";
  status: TableStatus;
};

type Shift = {
  id: string;
  started_at: string;
  status: "open" | "closed";
};

type ShiftSummary = {
  orderCount: number;
  total: number;
  payments: Record<string, number>;
};

export default function CashierPage() {
  const [tables, setTables] = useState<
    RestaurantTable[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [selectedTable, setSelectedTable] =
    useState<RestaurantTable | null>(null);

  const [currentShift, setCurrentShift] =
    useState<Shift | null>(null);

  const [shiftSummary, setShiftSummary] =
    useState<ShiftSummary | null>(null);

  const [shiftLoading, setShiftLoading] =
    useState(true);

  const [
    shiftActionLoading,
    setShiftActionLoading,
  ] = useState(false);

  const [showCloseShift, setShowCloseShift] =
    useState(false);

  const loadCurrentShift = async () => {
    const response = await fetch(
      "/api/shifts/current"
    );

    if (!response.ok) {
      setShiftLoading(false);
      return;
    }

    const data = await response.json();

    setCurrentShift(data.shift);
    setShiftSummary(data.summary);
    setShiftLoading(false);
  };

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
    loadCurrentShift();
  }, []);

  const openShift = async () => {
    setShiftActionLoading(true);

    const response = await fetch(
      "/api/shifts/open",
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Impossible d'ouvrir le shift."
      );

      setShiftActionLoading(false);
      return;
    }

    await loadCurrentShift();

    setShiftActionLoading(false);
  };

  const closeShift = async () => {
    setShiftActionLoading(true);

    const response = await fetch(
      "/api/shifts/close",
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Impossible de fermer le shift."
      );

      setShiftActionLoading(false);
      return;
    }

    setShowCloseShift(false);

    await loadCurrentShift();

    setShiftActionLoading(false);
  };

  const openOrder = async (
    tableId: string
  ) => {
    const response = await fetch(
      "/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          tableId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Impossible d'ouvrir la commande."
      );

      return;
    }

    window.location.href =
      `/cashier/orders/${data.orderId}`;
  };

  const viewOpenOrder = async (
    tableId: string
  ) => {
    const response = await fetch(
      `/api/orders/open?tableId=${tableId}`
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Commande introuvable."
      );

      return;
    }

    window.location.href =
      `/cashier/orders/${data.orderId}`;
  };

  const updateTableStatus = async (
    tableId: string,
    status: TableStatus
  ) => {
    const response = await fetch(
      `/api/tables/${tableId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Une erreur est survenue."
      );

      return;
    }

    setTables((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              status: data.status,
            }
          : table
      )
    );

    setSelectedTable(null);
  };

  const getStatusStyle = (
    status: TableStatus
  ) => {
    if (status === "occupied") {
      return "border-red-300 bg-red-100 text-red-700";
    }

    if (status === "reserved") {
      return "border-orange-300 bg-orange-100 text-orange-700";
    }

    return "border-green-300 bg-green-100 text-green-700";
  };

  const getStatusLabel = (
    status: TableStatus
  ) => {
    if (status === "occupied") {
      return "Occupée";
    }

    if (status === "reserved") {
      return "Réservée";
    }

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
              onClick={() =>
                setSelectedTable(table)
              }
              className={`min-h-24 rounded-2xl border p-4 text-left transition hover:scale-[1.02] ${getStatusStyle(
                table.status
              )}`}
            >
              <p className="font-semibold">
                {table.name}
              </p>

              <p className="mt-2 text-sm">
                {getStatusLabel(
                  table.status
                )}
              </p>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const available = tables.filter(
    (table) =>
      table.status === "available"
  ).length;

  const reserved = tables.filter(
    (table) =>
      table.status === "reserved"
  ).length;

  const occupied = tables.filter(
    (table) =>
      table.status === "occupied"
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Chargement des tables...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Espace caissier
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Tables
            </h1>
          </div>

          <LogoutButton />
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto">
          <Link
            href="/cashier"
            className="whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
          >
            Tables
          </Link>

          <Link
            href="/cashier/orders"
            className="whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
          >
            Commandes
          </Link>

          <Link
            href="/cashier/history"
            className="whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
          >
            Historique
          </Link>
        </div>

        <div className="mb-6">
          {shiftLoading ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              Chargement du shift...
            </div>
          ) : currentShift ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-emerald-800">
                  Shift ouvert
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  Depuis{" "}
                  {new Date(
                    currentShift.started_at
                  ).toLocaleTimeString(
                    "fr-FR",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>

              <button
                onClick={() =>
                  setShowCloseShift(true)
                }
                className="rounded-xl bg-white px-4 py-2 font-medium text-red-600 shadow-sm"
              >
                Fermer mon shift
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-amber-800">
                  Aucun shift ouvert
                </p>

                <p className="mt-1 text-sm text-amber-700">
                  Ouvrez votre shift avant
                  de commencer les
                  encaissements.
                </p>
              </div>

              <button
                onClick={openShift}
                disabled={
                  shiftActionLoading
                }
                className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {shiftActionLoading
                  ? "Ouverture..."
                  : "Ouvrir mon shift"}
              </button>
            </div>
          )}
        </div>

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

        {renderZone(
          "Box Terrasse",
          "Terrasse"
        )}

        {renderZone("Salle", "Salle")}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">
              {selectedTable.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {getStatusLabel(
                selectedTable.status
              )}
            </p>

            {selectedTable.status ===
              "available" && (
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
                    openOrder(
                      selectedTable.id
                    )
                  }
                  className="w-full rounded-xl bg-red-500 py-3 font-medium text-white"
                >
                  Ouvrir une commande
                </button>
              </div>
            )}

            {selectedTable.status ===
              "reserved" && (
              <div className="mt-6 space-y-3">
                <button
                  onClick={() =>
                    openOrder(
                      selectedTable.id
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

            {selectedTable.status ===
              "occupied" && (
              <div className="mt-6">
                <button
                  onClick={() =>
                    viewOpenOrder(
                      selectedTable.id
                    )
                  }
                  className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white"
                >
                  Voir la commande
                </button>
              </div>
            )}

            <button
              onClick={() =>
                setSelectedTable(null)
              }
              className="mt-4 w-full py-2 text-sm text-slate-500"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showCloseShift &&
        currentShift && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-2xl font-bold">
                Clôture du shift
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Vérifiez le récapitulatif
                avant de clôturer votre
                caisse.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">
                    Commandes
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {shiftSummary?.orderCount ||
                      0}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {shiftSummary?.total ||
                      0}{" "}
                    MRU
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {[
                  "Cash",
                  "Bankily",
                  "Masrivi",
                  "Sedad",
                  "BCI PAY",
                ].map((method) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span>
                      {method}
                    </span>

                    <span className="font-semibold">
                      {shiftSummary
                        ?.payments?.[
                        method
                      ] || 0}{" "}
                      MRU
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border p-4">
                <p className="text-sm text-slate-500">
                  Début du shift
                </p>

                <p className="mt-1 font-medium">
                  {new Date(
                    currentShift.started_at
                  ).toLocaleString(
                    "fr-FR",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() =>
                    setShowCloseShift(
                      false
                    )
                  }
                  disabled={
                    shiftActionLoading
                  }
                  className="flex-1 rounded-xl border py-3 font-medium disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  onClick={closeShift}
                  disabled={
                    shiftActionLoading
                  }
                  className="flex-1 rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {shiftActionLoading
                    ? "Fermeture..."
                    : "Confirmer la clôture"}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}