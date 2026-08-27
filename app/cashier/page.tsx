"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  useLocale,
  useTranslations,
} from "next-intl";
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
  const router =
    useRouter();

  const t =
    useTranslations(
      "Cashier"
    );

  const locale =
    useLocale();

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

  const formatMoney = (
    value: number
  ) => {
    return new Intl.NumberFormat(
      locale === "ar"
        ? "ar-MR"
        : "fr-FR",
      {
        maximumFractionDigits: 0,
      }
    ).format(value);
  };

  const formatShiftTime = (
    value: string
  ) => {
    return new Date(
      value
    ).toLocaleTimeString(
      locale === "ar"
        ? "ar-MR"
        : "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatShiftDateTime = (
    value: string
  ) => {
    return new Date(
      value
    ).toLocaleString(
      locale === "ar"
        ? "ar-MR"
        : "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const getPaymentLabel = (
    method: string
  ) => {
    if (
      method === "Cash"
    ) {
      return t(
        "payments.cash"
      );
    }

    return method;
  };

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
              t(
                "errors.loadTables"
              )
            );
          }
        } catch {
          notify(
            "error",
            t(
              "errors.loadTables"
            )
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
              t(
                "errors.openShift"
              )
          );
          return;
        }

        setShiftLoading(
          true
        );

        await loadCurrentShift();

        notify(
          "success",
          t(
            "feedback.shiftOpened"
          )
        );
      } catch {
        notify(
          "error",
          t(
            "errors.openShift"
          )
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
          t(
            "errors.prepareShiftClose"
          )
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
              t(
                "errors.closeShift"
              )
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
            t(
              "feedback.shiftClosed"
            )
          );
        }
      } catch {
        setShiftCloseError(
          t(
            "errors.closeShift"
          )
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
              t(
                "errors.openOrder"
              )
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
          t(
            "errors.openOrder"
          )
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
              t(
                "errors.createTakeaway"
              )
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
          t(
            "errors.createTakeaway"
          )
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
              t(
                "errors.orderNotFound"
              )
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
          t(
            "errors.openOrder"
          )
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
              t(
                "errors.updateTable"
              )
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
            ? t(
                "feedback.tableReserved"
              )
            : t(
                "feedback.reservationCancelled"
              )
        );
      } catch {
        notify(
          "error",
          t(
            "errors.updateTable"
          )
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
      return t(
        "statuses.occupied"
      );
    }

    if (
      status ===
      "reserved"
    ) {
      return t(
        "statuses.reserved"
      );
    }

    return t(
      "statuses.available"
    );
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1F2924]">
            {title}
          </h2>

          <span className="text-sm text-[#8A918C]">
            {t(
              "locations",
              {
                count:
                  zoneTables.length,
              }
            )}
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
                className={`min-h-[92px] rounded-[20px] border p-4 text-start transition active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-sm ${getStatusStyle(
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
            {t(
              "loadingCashier"
            )}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
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
                  {t(
                    "cashier"
                  )}
                </p>
              </div>
            </div>

            <LogoutButton />
          </div>
        </header>

        <nav className="mb-5 flex gap-1 rounded-2xl border border-[#E5E2DA] bg-white p-1 shadow-sm">
          <Link
            href="/cashier"
            className="flex-1 rounded-xl bg-[#1E4D3A] px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            {t(
              "navigation.tables"
            )}
          </Link>

          <Link
            href="/cashier/orders"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            {t(
              "navigation.orders"
            )}
          </Link>

          <Link
            href="/cashier/history"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            {t(
              "navigation.history"
            )}
          </Link>
        </nav>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2E6A50]">
              {t(
                "serviceInProgress"
              )}
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-[#1F2924]">
              {t(
                "navigation.tables"
              )}
            </h1>

            <p className="mt-1 text-sm text-[#737A75]">
              {t(
                "touchTable"
              )}
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

                {t(
                  "creating"
                )}
              </>
            ) : (
              <>
                <span className="text-xl leading-none">
                  +
                </span>

                {t(
                  "takeaway"
                )}
              </>
            )}
          </button>
        </div>

        <section className="mb-5">
          {shiftLoading ? (
            <div className="flex min-h-[76px] items-center gap-3 rounded-[20px] border border-[#E5E2DA] bg-white px-4 shadow-sm">
              <Spinner
                dark
              />

              <p className="text-sm font-medium text-[#68706B]">
                {t(
                  "shift.checking"
                )}
              </p>
            </div>
          ) : currentShift ? (
            <div className="flex flex-col gap-3 rounded-[20px] border border-[#C7DACD] bg-[#EDF5EF] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#3D7D5E]" />

                <div>
                  <p className="font-bold text-[#1E4D3A]">
                    {t(
                      "shift.open"
                    )}
                  </p>

                  <p className="mt-0.5 text-sm text-[#567362]">
                    {t(
                      "shift.since",
                      {
                        time:
                          formatShiftTime(
                            currentShift.started_at
                          ),
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

                    {t(
                      "shift.preparing"
                    )}
                  </>
                ) : (
                  t(
                    "shift.closeMine"
                  )
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[20px] border border-[#EED3A8] bg-[#FFF6E9] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#D4862D]" />

                <div>
                  <p className="font-bold text-[#8D5519]">
                    {t(
                      "shift.closed"
                    )}
                  </p>

                  <p className="mt-0.5 text-sm text-[#96704B]">
                    {t(
                      "shift.openBeforePayments"
                    )}
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

                    {t(
                      "shift.opening"
                    )}
                  </>
                ) : (
                  t(
                    "shift.openMine"
                  )
                )}
              </button>
            </div>
          )}
        </section>

        <section className="mb-7 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#E5E2DA] bg-white shadow-sm">
          <div className="border-e border-[#ECE9E2] px-3 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />

              <span className="text-xs font-medium text-[#737A75]">
                {t(
                  "tableCounters.free"
                )}
              </span>
            </div>

            <p className="mt-1 text-xl font-bold text-[#1E4D3A]">
              {available}
            </p>
          </div>

          <div className="border-e border-[#ECE9E2] px-3 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D4862D]" />

              <span className="text-xs font-medium text-[#737A75]">
                {t(
                  "tableCounters.reserved"
                )}
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
                {t(
                  "tableCounters.occupied"
                )}
              </span>
            </div>

            <p className="mt-1 text-xl font-bold text-[#A74435]">
              {occupied}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#1F2924]">
              {t(
                "floorPlan.title"
              )}
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              {t(
                "floorPlan.description"
              )}
            </p>
          </div>

          {renderZone(
            t(
              "zones.vip"
            ),
            "VIP"
          )}

          {renderZone(
            t(
              "zones.terrace"
            ),
            "Terrasse"
          )}

          {renderZone(
            t(
              "zones.room"
            ),
            "Salle"
          )}
        </section>
      </div>

      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201B]/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#7A817C]">
                  {t(
                    "tableModal.table"
                  )}
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

                      {t(
                        "opening"
                      )}
                    </>
                  ) : (
                    t(
                      "tableModal.openOrder"
                    )
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

                      {t(
                        "reserving"
                      )}
                    </>
                  ) : (
                    t(
                      "tableModal.reserve"
                    )
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

                      {t(
                        "opening"
                      )}
                    </>
                  ) : (
                    t(
                      "tableModal.customerArrived"
                    )
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

                      {t(
                        "cancelling"
                      )}
                    </>
                  ) : (
                    t(
                      "tableModal.cancelReservation"
                    )
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

                      {t(
                        "opening"
                      )}
                    </>
                  ) : (
                    t(
                      "tableModal.viewOrder"
                    )
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
              {t(
                "close"
              )}
            </button>
          </div>
        </div>
      )}

      {showCloseShift &&
        currentShift && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17201B]/50 p-4 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
              <div>
                <p className="text-sm font-semibold text-[#A74435]">
                  {t(
                    "shiftClose.endService"
                  )}
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  {t(
                    "shiftClose.title"
                  )}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#737A75]">
                  {t(
                    "shiftClose.description"
                  )}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#F6F6F2] p-3.5">
                  <p className="text-xs text-[#7A817C]">
                    {t(
                      "shiftClose.paid"
                    )}
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#1F2924]">
                    {shiftSummary
                      ?.paidOrderCount ||
                      0}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FFF4F1] p-3.5">
                  <p className="text-xs text-[#9A6A62]">
                    {t(
                      "shiftClose.cancelled"
                    )}
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#A74435]">
                    {shiftSummary
                      ?.cancelledOrderCount ||
                      0}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#EDF5EF] p-3.5">
                  <p className="text-xs text-[#567362]">
                    {t(
                      "shiftClose.revenue"
                    )}
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
                  {t(
                    "shiftClose.startedAt"
                  )}
                </p>

                <p className="mt-1 font-semibold text-[#343D38]">
                  {formatShiftDateTime(
                    currentShift.started_at
                  )}
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-bold text-[#343D38]">
                  {t(
                    "shiftClose.payments"
                  )}
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
                          {getPaymentLabel(
                            method
                          )}
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
                    {t(
                      "shiftClose.cannotClose"
                    )}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#A35C51]">
                    {t(
                      "shiftClose.openOrders",
                      {
                        count:
                          shiftSummary
                            ?.openOrderCount ||
                          0,
                      }
                    )}
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
                              {t(
                                "shiftClose.process"
                              )}
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
                    {t(
                      "shiftClose.allProcessed"
                    )}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#667D6D]">
                    {t(
                      "shiftClose.reportsGenerated"
                    )}
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
                  {t(
                    "back"
                  )}
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

                      {t(
                        "shiftClose.closing"
                      )}
                    </>
                  ) : (
                    t(
                      "shiftClose.confirm"
                    )
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}