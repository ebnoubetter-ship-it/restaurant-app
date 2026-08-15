"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

type TableStatus =
  | "available"
  | "reserved"
  | "occupied";

type RestaurantTable = {
  id: string;
  name: string;
  zone:
    | "VIP"
    | "Terrasse"
    | "Salle";
  status: TableStatus;
};

type Shift = {
  id: string;
  started_at: string;
  status: "open" | "closed";
};

type OpenShiftOrder = {
  id: string;
  orderNumber: number | null;
  label: string;
};

type ShiftSummary = {
  orderCount: number;
  paidOrderCount: number;
  cancelledOrderCount: number;
  openOrderCount: number;
  total: number;
  payments: Record<string, number>;
  openOrders: OpenShiftOrder[];
};

type Feedback =
  | {
      type:
        | "success"
        | "error"
        | "warning";
      message: string;
    }
  | null;

type TableAction =
  | "open-order"
  | "view-order"
  | "reserve"
  | "cancel-reservation"
  | null;

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function Spinner({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        dark
          ? "border-[#1E4D3A]/20 border-t-[#1E4D3A]"
          : "border-white/30 border-t-white"
      }`}
    />
  );
}

export default function CashierPage() {
  const router = useRouter();

  const [
    tables,
    setTables,
  ] = useState<
    RestaurantTable[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    selectedTable,
    setSelectedTable,
  ] =
    useState<RestaurantTable | null>(
      null
    );

  const [
    currentShift,
    setCurrentShift,
  ] =
    useState<Shift | null>(
      null
    );

  const [
    shiftSummary,
    setShiftSummary,
  ] =
    useState<ShiftSummary | null>(
      null
    );

  const [
    shiftLoading,
    setShiftLoading,
  ] = useState(true);

  const [
    shiftActionLoading,
    setShiftActionLoading,
  ] = useState(false);

  const [
    showCloseShift,
    setShowCloseShift,
  ] = useState(false);

  const [
    takeawayLoading,
    setTakeawayLoading,
  ] = useState(false);

  const [
    tableAction,
    setTableAction,
  ] =
    useState<TableAction>(
      null
    );

  const [
    shiftCloseError,
    setShiftCloseError,
  ] = useState("");

  const [
    feedback,
    setFeedback,
  ] =
    useState<Feedback>(
      null
    );

  /*
   * Notification non bloquante.
   * Aucun clic supplémentaire
   * demandé au caissier.
   */
  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setFeedback(
            null
          );
        },
        3500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [feedback]);

  const notify = (
    type:
      | "success"
      | "error"
      | "warning",
    message: string
  ) => {
    setFeedback({
      type,
      message,
    });
  };

  const loadCurrentShift =
    async () => {
      try {
        const response =
          await fetch(
            "/api/shifts/current",
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          return false;
        }

        setCurrentShift(
          data.shift
        );

        setShiftSummary(
          data.summary
        );

        return true;
      } catch {
        return false;
      } finally {
        setShiftLoading(
          false
        );
      }
    };

  useEffect(() => {
    const loadTables =
      async () => {
        try {
          const response =
            await fetch(
              "/api/tables",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            response.ok
          ) {
            setTables(
              data
            );
          } else {
            notify(
              "error",
              data.error ||
                "Impossible de charger les tables."
            );
          }
        } catch {
          notify(
            "error",
            "Impossible de charger les tables."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    loadTables();
    loadCurrentShift();
  }, []);

  const openShift =
    async () => {
      if (
        shiftActionLoading
      ) {
        return;
      }

      setShiftActionLoading(
        true
      );

      try {
        const response =
          await fetch(
            "/api/shifts/open",
            {
              method: "POST",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              "Impossible d'ouvrir le shift."
          );
          return;
        }

        setShiftLoading(
          true
        );

        await loadCurrentShift();

        notify(
          "success",
          "Shift ouvert."
        );
      } catch {
        notify(
          "error",
          "Impossible d'ouvrir le shift."
        );
      } finally {
        setShiftActionLoading(
          false
        );
      }
    };

  const openCloseShiftModal =
    async () => {
      if (
        shiftActionLoading
      ) {
        return;
      }

      setShiftActionLoading(
        true
      );

      setShiftCloseError(
        ""
      );

      setShiftLoading(
        true
      );

      const success =
        await loadCurrentShift();

      setShiftActionLoading(
        false
      );

      if (!success) {
        notify(
          "error",
          "Impossible de préparer la clôture du shift."
        );
        return;
      }

      setShowCloseShift(
        true
      );
    };

  const closeShift =
    async () => {
      if (
        shiftActionLoading
      ) {
        return;
      }

      setShiftActionLoading(
        true
      );

      setShiftCloseError(
        ""
      );

      try {
        const response =
          await fetch(
            "/api/shifts/close",
            {
              method: "POST",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setShiftCloseError(
            data.error ||
              "Impossible de fermer le shift."
          );

          setShiftLoading(
            true
          );

          await loadCurrentShift();

          return;
        }

        setShowCloseShift(
          false
        );

        setShiftLoading(
          true
        );

        await loadCurrentShift();

        if (
          data.warning
        ) {
          notify(
            "warning",
            data.warning
          );
        } else {
          notify(
            "success",
            "Shift clôturé avec succès."
          );
        }
      } catch {
        setShiftCloseError(
          "Impossible de fermer le shift."
        );
      } finally {
        setShiftActionLoading(
          false
        );
      }
    };

  const openOrder =
    async (
      tableId: string
    ) => {
      if (
        tableAction
      ) {
        return;
      }

      setTableAction(
        "open-order"
      );

      try {
        const response =
          await fetch(
            "/api/orders",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    tableId,
                    orderType:
                      "dine_in",
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              "Impossible d'ouvrir la commande."
          );

          setTableAction(
            null
          );

          return;
        }

        router.push(
          `/cashier/orders/${data.orderId}`
        );
      } catch {
        notify(
          "error",
          "Impossible d'ouvrir la commande."
        );

        setTableAction(
          null
        );
      }
    };

  const openTakeawayOrder =
    async () => {
      if (
        takeawayLoading
      ) {
        return;
      }

      setTakeawayLoading(
        true
      );

      try {
        const response =
          await fetch(
            "/api/orders",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    orderType:
                      "takeaway",
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              "Impossible de créer la commande à emporter."
          );

          setTakeawayLoading(
            false
          );

          return;
        }

        router.push(
          `/cashier/orders/${data.orderId}`
        );
      } catch {
        notify(
          "error",
          "Impossible de créer la commande à emporter."
        );

        setTakeawayLoading(
          false
        );
      }
    };

  const viewOpenOrder =
    async (
      tableId: string
    ) => {
      if (
        tableAction
      ) {
        return;
      }

      setTableAction(
        "view-order"
      );

      try {
        const response =
          await fetch(
            `/api/orders/open?tableId=${tableId}`
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              "Commande introuvable."
          );

          setTableAction(
            null
          );

          return;
        }

        router.push(
          `/cashier/orders/${data.orderId}`
        );
      } catch {
        notify(
          "error",
          "Impossible d'ouvrir la commande."
        );

        setTableAction(
          null
        );
      }
    };

  const updateTableStatus =
    async (
      tableId: string,
      status: TableStatus
    ) => {
      if (
        tableAction
      ) {
        return;
      }

      const action:
        TableAction =
        status ===
        "reserved"
          ? "reserve"
          : "cancel-reservation";

      setTableAction(
        action
      );

      try {
        const response =
          await fetch(
            `/api/tables/${tableId}/status`,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    status,
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              "Impossible de modifier la table."
          );

          return;
        }

        setTables(
          (
            currentTables
          ) =>
            currentTables.map(
              (
                table
              ) =>
                table.id ===
                tableId
                  ? {
                      ...table,
                      status:
                        data.status,
                    }
                  : table
            )
        );

        setSelectedTable(
          null
        );

        notify(
          "success",
          status ===
            "reserved"
            ? "Table réservée."
            : "Réservation annulée."
        );
      } catch {
        notify(
          "error",
          "Impossible de modifier la table."
        );
      } finally {
        setTableAction(
          null
        );
      }
    };

  const getStatusStyle = (
    status: TableStatus
  ) => {
    if (
      status ===
      "occupied"
    ) {
      return "border-[#E9BDB5] bg-[#FFF1EE] text-[#A74435]";
    }

    if (
      status ===
      "reserved"
    ) {
      return "border-[#EED3A8] bg-[#FFF6E9] text-[#9A5A18]";
    }

    return "border-[#BDD5C4] bg-[#EDF5EF] text-[#1E4D3A]";
  };

  const getStatusDot = (
    status: TableStatus
  ) => {
    if (
      status ===
      "occupied"
    ) {
      return "bg-[#C65343]";
    }

    if (
      status ===
      "reserved"
    ) {
      return "bg-[#D4862D]";
    }

    return "bg-[#3D7D5E]";
  };

  const getStatusLabel = (
    status: TableStatus
  ) => {
    if (
      status ===
      "occupied"
    ) {
      return "Occupée";
    }

    if (
      status ===
      "reserved"
    ) {
      return "Réservée";
    }

    return "Disponible";
  };

  const getTableNumber = (
    name: string
  ) => {
    const match =
      name.match(
        /\d+/
      );

    return match
      ? Number(
          match[0]
        )
      : 999999;
  };

  const renderZone = (
    title: string,
    zone:
      RestaurantTable["zone"]
  ) => {
    let zoneTables =
      tables.filter(
        (table) =>
          table.zone ===
          zone
      );

    if (
      zone === "Salle"
    ) {
      zoneTables = [
        ...zoneTables,
      ].sort(
        (a, b) =>
          getTableNumber(
            a.name
          ) -
          getTableNumber(
            b.name
          )
      );
    }

    return (
      <section className="mb-9">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1F2924]">
            {title}
          </h2>

          <span className="text-sm text-[#8A918C]">
            {
              zoneTables.length
            }{" "}
            emplacement
            {zoneTables.length >
            1
              ? "s"
              : ""}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {zoneTables.map(
            (table) => (
              <button
                type="button"
                key={
                  table.id
                }
                onClick={() =>
                  setSelectedTable(
                    table
                  )
                }
                className={`min-h-[92px] rounded-[20px] border p-4 text-left transition active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-sm ${getStatusStyle(
                  table.status
                )}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">
                    {
                      table.name
                    }
                  </p>

                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDot(
                      table.status
                    )}`}
                  />
                </div>

                <p className="mt-3 text-xs font-semibold opacity-75">
                  {getStatusLabel(
                    table.status
                  )}
                </p>
              </button>
            )
          )}
        </div>
      </section>
    );
  };

  const available =
    tables.filter(
      (table) =>
        table.status ===
        "available"
    ).length;

  const reserved =
    tables.filter(
      (table) =>
        table.status ===
        "reserved"
    ).length;

  const occupied =
    tables.filter(
      (table) =>
        table.status ===
        "occupied"
    ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F2EB] p-4">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
            M
          </div>

          <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-[3px] border-[#D4DDD7] border-t-[#1E4D3A]" />

          <p className="mt-4 font-semibold text-[#343D38]">
            Chargement de la
            caisse...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      {/* FEEDBACK */}
      {feedback && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-lg ${
              feedback.type ===
              "success"
                ? "border-[#C7DACD] bg-[#EDF5EF] text-[#1E4D3A]"
                : feedback.type ===
                  "warning"
                ? "border-[#EED3A8] bg-[#FFF6E9] text-[#8D5519]"
                : "border-[#EDC7C0] bg-[#FFF1EE] text-[#A74435]"
            }`}
          >
            <p className="text-sm font-semibold">
              {
                feedback.message
              }
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
                M
              </div>

              <div>
                <p className="text-lg font-black tracking-[-0.03em] text-[#1F2924]">
                  MAIDA
                </p>

                <p className="text-xs text-[#7A817C]">
                  Caisse
                </p>
              </div>
            </div>

            <LogoutButton />
          </div>
        </header>

        {/* NAVIGATION */}
        <nav className="mb-5 flex gap-1 rounded-2xl border border-[#E5E2DA] bg-white p-1 shadow-sm">
          <Link
            href="/cashier"
            className="flex-1 rounded-xl bg-[#1E4D3A] px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            Tables
          </Link>

          <Link
            href="/cashier/orders"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            Commandes
          </Link>

          <Link
            href="/cashier/history"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            Historique
          </Link>
        </nav>

        {/* TITRE + À EMPORTER */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2E6A50]">
              Service en cours
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-[#1F2924]">
              Tables
            </h1>

            <p className="mt-1 text-sm text-[#737A75]">
              Touchez une table
              pour agir.
            </p>
          </div>

          <button
            type="button"
            onClick={
              openTakeawayOrder
            }
            disabled={
              takeawayLoading
            }
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
          >
            {takeawayLoading ? (
              <>
                <Spinner />
                Création...
              </>
            ) : (
              <>
                <span className="text-xl leading-none">
                  +
                </span>
                À emporter
              </>
            )}
          </button>
        </div>

        {/* SHIFT */}
        <section className="mb-5">
          {shiftLoading ? (
            <div className="flex min-h-[76px] items-center gap-3 rounded-[20px] border border-[#E5E2DA] bg-white px-4 shadow-sm">
              <Spinner
                dark
              />

              <p className="text-sm font-medium text-[#68706B]">
                Vérification du
                shift...
              </p>
            </div>
          ) : currentShift ? (
            <div className="flex flex-col gap-3 rounded-[20px] border border-[#C7DACD] bg-[#EDF5EF] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#3D7D5E]" />

                <div>
                  <p className="font-bold text-[#1E4D3A]">
                    Shift ouvert
                  </p>

                  <p className="mt-0.5 text-sm text-[#567362]">
                    Depuis{" "}
                    {new Date(
                      currentShift.started_at
                    ).toLocaleTimeString(
                      "fr-FR",
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      }
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  openCloseShiftModal
                }
                disabled={
                  shiftActionLoading
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C7DACD] bg-white px-4 text-sm font-semibold text-[#A74435] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                {shiftActionLoading ? (
                  <>
                    <Spinner
                      dark
                    />
                    Préparation...
                  </>
                ) : (
                  "Fermer mon shift"
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[20px] border border-[#EED3A8] bg-[#FFF6E9] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#D4862D]" />

                <div>
                  <p className="font-bold text-[#8D5519]">
                    Shift fermé
                  </p>

                  <p className="mt-0.5 text-sm text-[#96704B]">
                    Ouvrez votre
                    shift avant les
                    encaissements.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  openShift
                }
                disabled={
                  shiftActionLoading
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E4D3A] px-4 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
              >
                {shiftActionLoading ? (
                  <>
                    <Spinner />
                    Ouverture...
                  </>
                ) : (
                  "Ouvrir mon shift"
                )}
              </button>
            </div>
          )}
        </section>

        {/* ÉTAT DES TABLES */}
        <section className="mb-7 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#E5E2DA] bg-white shadow-sm">
          <div className="border-r border-[#ECE9E2] px-3 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />

              <span className="text-xs font-medium text-[#737A75]">
                Libres
              </span>
            </div>

            <p className="mt-1 text-xl font-bold text-[#1E4D3A]">
              {available}
            </p>
          </div>

          <div className="border-r border-[#ECE9E2] px-3 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D4862D]" />

              <span className="text-xs font-medium text-[#737A75]">
                Réservées
              </span>
            </div>

            <p className="mt-1 text-xl font-bold text-[#9A5A18]">
              {reserved}
            </p>
          </div>

          <div className="px-3 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#C65343]" />

              <span className="text-xs font-medium text-[#737A75]">
                Occupées
              </span>
            </div>

            <p className="mt-1 text-xl font-bold text-[#A74435]">
              {occupied}
            </p>
          </div>
        </section>

        {/* PLAN DE SALLE */}
        <section>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#1F2924]">
              Plan de salle
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              Les couleurs indiquent
              immédiatement le statut
              de chaque table.
            </p>
          </div>

          {renderZone(
            "VIP",
            "VIP"
          )}

          {renderZone(
            "Box Terrasse",
            "Terrasse"
          )}

          {renderZone(
            "Salle",
            "Salle"
          )}
        </section>
      </div>

      {/* MODAL TABLE */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201B]/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#7A817C]">
                  Table
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  {
                    selectedTable.name
                  }
                </h2>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusStyle(
                  selectedTable.status
                )}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${getStatusDot(
                    selectedTable.status
                  )}`}
                />

                {getStatusLabel(
                  selectedTable.status
                )}
              </span>
            </div>

            {selectedTable.status ===
              "available" && (
              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    openOrder(
                      selectedTable.id
                    )
                  }
                  disabled={
                    Boolean(
                      tableAction
                    )
                  }
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E4D3A] px-4 font-semibold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
                >
                  {tableAction ===
                  "open-order" ? (
                    <>
                      <Spinner />
                      Ouverture...
                    </>
                  ) : (
                    "Ouvrir une commande"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateTableStatus(
                      selectedTable.id,
                      "reserved"
                    )
                  }
                  disabled={
                    Boolean(
                      tableAction
                    )
                  }
                  className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5D1B4] bg-[#FFF8ED] px-4 font-semibold text-[#946021] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  {tableAction ===
                  "reserve" ? (
                    <>
                      <Spinner
                        dark
                      />
                      Réservation...
                    </>
                  ) : (
                    "Réserver la table"
                  )}
                </button>
              </div>
            )}

            {selectedTable.status ===
              "reserved" && (
              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    openOrder(
                      selectedTable.id
                    )
                  }
                  disabled={
                    Boolean(
                      tableAction
                    )
                  }
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E4D3A] px-4 font-semibold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
                >
                  {tableAction ===
                  "open-order" ? (
                    <>
                      <Spinner />
                      Ouverture...
                    </>
                  ) : (
                    "Client arrivé"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateTableStatus(
                      selectedTable.id,
                      "available"
                    )
                  }
                  disabled={
                    Boolean(
                      tableAction
                    )
                  }
                  className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E2DA] bg-white px-4 font-semibold text-[#68706B] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  {tableAction ===
                  "cancel-reservation" ? (
                    <>
                      <Spinner
                        dark
                      />
                      Annulation...
                    </>
                  ) : (
                    "Annuler la réservation"
                  )}
                </button>
              </div>
            )}

            {selectedTable.status ===
              "occupied" && (
              <div className="mt-7">
                <button
                  type="button"
                  onClick={() =>
                    viewOpenOrder(
                      selectedTable.id
                    )
                  }
                  disabled={
                    Boolean(
                      tableAction
                    )
                  }
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E4D3A] px-4 font-semibold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
                >
                  {tableAction ===
                  "view-order" ? (
                    <>
                      <Spinner />
                      Ouverture...
                    </>
                  ) : (
                    "Voir la commande"
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setSelectedTable(
                  null
                )
              }
              disabled={
                Boolean(
                  tableAction
                )
              }
              className="mt-4 min-h-11 w-full text-sm font-medium text-[#8A918C] disabled:opacity-40"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* MODAL CLÔTURE SHIFT */}
      {showCloseShift &&
        currentShift && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17201B]/50 p-4 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
              <div>
                <p className="text-sm font-semibold text-[#A74435]">
                  Fin de service
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  Clôturer le shift
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#737A75]">
                  Vérifiez le
                  récapitulatif avant
                  de clôturer votre
                  caisse.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#F6F6F2] p-3.5">
                  <p className="text-xs text-[#7A817C]">
                    Payées
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#1F2924]">
                    {shiftSummary
                      ?.paidOrderCount ||
                      0}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FFF4F1] p-3.5">
                  <p className="text-xs text-[#9A6A62]">
                    Annulées
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#A74435]">
                    {shiftSummary
                      ?.cancelledOrderCount ||
                      0}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#EDF5EF] p-3.5">
                  <p className="text-xs text-[#567362]">
                    CA
                  </p>

                  <p className="mt-1 text-lg font-bold text-[#1E4D3A]">
                    {formatMoney(
                      shiftSummary
                        ?.total ||
                        0
                    )}
                  </p>

                  <p className="text-[10px] text-[#6D8274]">
                    MRU
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[#E8E5DE] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#9A9F9B]">
                  Début du shift
                </p>

                <p className="mt-1 font-semibold text-[#343D38]">
                  {new Date(
                    currentShift.started_at
                  ).toLocaleString(
                    "fr-FR",
                    {
                      day:
                        "2-digit",
                      month:
                        "2-digit",
                      year:
                        "numeric",
                      hour:
                        "2-digit",
                      minute:
                        "2-digit",
                    }
                  )}
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-bold text-[#343D38]">
                  Paiements
                </p>

                <div className="overflow-hidden rounded-2xl border border-[#E8E5DE]">
                  {paymentMethods.map(
                    (
                      method,
                      index
                    ) => (
                      <div
                        key={
                          method
                        }
                        className={`flex items-center justify-between px-4 py-3 ${
                          index <
                          paymentMethods.length -
                            1
                            ? "border-b border-[#EEECE6]"
                            : ""
                        }`}
                      >
                        <span className="text-sm text-[#68706B]">
                          {
                            method
                          }
                        </span>

                        <span className="text-sm font-bold text-[#1F2924]">
                          {formatMoney(
                            shiftSummary
                              ?.payments?.[
                              method
                            ] || 0
                          )}{" "}
                          MRU
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {(shiftSummary
                ?.openOrderCount ||
                0) > 0 && (
                <div className="mt-5 rounded-2xl border border-[#EDC7C0] bg-[#FFF1EE] p-4">
                  <p className="font-bold text-[#A74435]">
                    Fermeture
                    impossible
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#A35C51]">
                    {
                      shiftSummary
                        ?.openOrderCount
                    }{" "}
                    commande
                    {(shiftSummary
                      ?.openOrderCount ||
                      0) > 1
                      ? "s sont encore ouvertes."
                      : " est encore ouverte."}
                  </p>

                  <div className="mt-3 space-y-2">
                    {shiftSummary
                      ?.openOrders?.map(
                        (
                          order
                        ) => (
                          <Link
                            key={
                              order.id
                            }
                            href={`/cashier/orders/${order.id}`}
                            className="flex min-h-12 items-center justify-between rounded-xl bg-white px-3 text-sm shadow-sm"
                          >
                            <span className="font-semibold text-[#343D38]">
                              {
                                order.label
                              }

                              {order.orderNumber
                                ? ` · #${order.orderNumber}`
                                : ""}
                            </span>

                            <span className="font-semibold text-[#1E4D3A]">
                              Traiter →
                            </span>
                          </Link>
                        )
                      )}
                  </div>
                </div>
              )}

              {shiftCloseError && (
                <div className="mt-5 rounded-2xl border border-[#EDC7C0] bg-[#FFF1EE] px-4 py-3 text-sm font-medium text-[#A74435]">
                  {
                    shiftCloseError
                  }
                </div>
              )}

              {(shiftSummary
                ?.openOrderCount ||
                0) === 0 && (
                <div className="mt-5 rounded-2xl border border-[#C7DACD] bg-[#EDF5EF] px-4 py-3">
                  <p className="text-sm font-semibold text-[#1E4D3A]">
                    Toutes les
                    commandes sont
                    traitées.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#667D6D]">
                    Les rapports de
                    caisse et produits
                    seront générés
                    automatiquement.
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCloseShift(
                      false
                    );

                    setShiftCloseError(
                      ""
                    );
                  }}
                  disabled={
                    shiftActionLoading
                  }
                  className="min-h-13 flex-1 rounded-2xl border border-[#E3E0D8] font-semibold text-[#68706B] disabled:opacity-50"
                >
                  Retour
                </button>

                <button
                  type="button"
                  onClick={
                    closeShift
                  }
                  disabled={
                    shiftActionLoading ||
                    (shiftSummary
                      ?.openOrderCount ||
                      0) > 0
                  }
                  className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B84B3C] px-3 font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {shiftActionLoading ? (
                    <>
                      <Spinner />
                      Clôture...
                    </>
                  ) : (
                    "Confirmer"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}