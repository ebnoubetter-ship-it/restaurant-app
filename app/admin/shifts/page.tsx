import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Period =
  | "today"
  | "week"
  | "month"
  | "all";

type ShiftRow = {
  id: string;
  cashier_id: string;
  started_at: string;
  ended_at: string | null;
  status: "open" | "closed";
};

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

function getBusinessDate() {
  const now = new Date();

  const businessDate = new Date(now);

  if (now.getUTCHours() < 7) {
    businessDate.setUTCDate(
      businessDate.getUTCDate() - 1
    );
  }

  return businessDate;
}

function getTodayRange() {
  const businessDate = getBusinessDate();

  const start = new Date(
    Date.UTC(
      businessDate.getUTCFullYear(),
      businessDate.getUTCMonth(),
      businessDate.getUTCDate(),
      7,
      0,
      0
    )
  );

  const end = new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 1
  );

  return {
    start,
    end,
  };
}

function getWeekRange() {
  const businessDate = getBusinessDate();

  const day =
    businessDate.getUTCDay();

  const daysSinceMonday =
    day === 0 ? 6 : day - 1;

  const start = new Date(
    Date.UTC(
      businessDate.getUTCFullYear(),
      businessDate.getUTCMonth(),
      businessDate.getUTCDate(),
      7,
      0,
      0
    )
  );

  start.setUTCDate(
    start.getUTCDate() -
      daysSinceMonday
  );

  const end = new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 7
  );

  return {
    start,
    end,
  };
}

function getMonthRange() {
  const businessDate = getBusinessDate();

  const start = new Date(
    Date.UTC(
      businessDate.getUTCFullYear(),
      businessDate.getUTCMonth(),
      1,
      7,
      0,
      0
    )
  );

  const end = new Date(
    Date.UTC(
      businessDate.getUTCFullYear(),
      businessDate.getUTCMonth() + 1,
      1,
      7,
      0,
      0
    )
  );

  return {
    start,
    end,
  };
}

function formatDuration(
  startedAt: string,
  endedAt: string | null
) {
  const start =
    new Date(startedAt).getTime();

  const end = endedAt
    ? new Date(endedAt).getTime()
    : Date.now();

  const duration =
    Math.max(0, end - start);

  const totalMinutes =
    Math.floor(
      duration / 1000 / 60
    );

  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes
    .toString()
    .padStart(2, "0")}`;
}

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
  }>;
}) {
  const params = await searchParams;

  const selectedPeriod: Period =
    params.period === "week"
      ? "week"
      : params.period === "month"
      ? "month"
      : params.period === "all"
      ? "all"
      : "today";

  let shiftsQuery =
    supabaseAdmin
      .from("shifts")
      .select(`
        id,
        cashier_id,
        started_at,
        ended_at,
        status
      `)
      .order("started_at", {
        ascending: false,
      });

  if (
    selectedPeriod === "today"
  ) {
    const { start, end } =
      getTodayRange();

    shiftsQuery = shiftsQuery
      .gte(
        "started_at",
        start.toISOString()
      )
      .lt(
        "started_at",
        end.toISOString()
      );
  }

  if (
    selectedPeriod === "week"
  ) {
    const { start, end } =
      getWeekRange();

    shiftsQuery = shiftsQuery
      .gte(
        "started_at",
        start.toISOString()
      )
      .lt(
        "started_at",
        end.toISOString()
      );
  }

  if (
    selectedPeriod === "month"
  ) {
    const { start, end } =
      getMonthRange();

    shiftsQuery = shiftsQuery
      .gte(
        "started_at",
        start.toISOString()
      )
      .lt(
        "started_at",
        end.toISOString()
      );
  }

  const {
    data: shiftsData,
    error: shiftsError,
  } = await shiftsQuery;

  if (shiftsError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/admin"
            className="text-sm text-sky-600"
          >
            ← Retour à
            l&apos;administration
          </Link>

          <p className="mt-6">
            Impossible de charger les
            shifts.
          </p>
        </div>
      </main>
    );
  }

  const shifts =
    (shiftsData ||
      []) as ShiftRow[];

  const cashierIds = [
    ...new Set(
      shifts.map(
        (shift) =>
          shift.cashier_id
      )
    ),
  ];

  let cashierNames: Record<
    string,
    string
  > = {};

  if (cashierIds.length > 0) {
    const { data: users } =
      await supabaseAdmin
        .from("users")
        .select("id, name")
        .in("id", cashierIds);

    cashierNames =
      (users || []).reduce(
        (
          result: Record<
            string,
            string
          >,
          user
        ) => {
          result[user.id] =
            user.name;

          return result;
        },
        {}
      );
  }

  const shiftIds =
    shifts.map(
      (shift) => shift.id
    );

  let orders: {
    shift_id: string | null;
    total: number;
    payment_method:
      | string
      | null;
  }[] = [];

  if (shiftIds.length > 0) {
    const {
      data: ordersData,
    } = await supabaseAdmin
      .from("orders")
      .select(`
        shift_id,
        total,
        payment_method
      `)
      .eq("status", "paid")
      .in(
        "shift_id",
        shiftIds
      );

    orders =
      (ordersData || []).map(
        (order) => ({
          shift_id:
            order.shift_id,
          total: Number(
            order.total || 0
          ),
          payment_method:
            order.payment_method,
        })
      );
  }

  const shiftSummaries =
    shifts.map((shift) => {
      const shiftOrders =
        orders.filter(
          (order) =>
            order.shift_id ===
            shift.id
        );

      const total =
        shiftOrders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.total || 0
            ),
          0
        );

      const payments: Record<
        string,
        number
      > = {
        Cash: 0,
        Bankily: 0,
        Masrivi: 0,
        Sedad: 0,
        "BCI PAY": 0,
      };

      for (const order of shiftOrders) {
        if (
          !order.payment_method
        ) {
          continue;
        }

        payments[
          order.payment_method
        ] =
          (payments[
            order.payment_method
          ] || 0) +
          Number(
            order.total || 0
          );
      }

      return {
        ...shift,
        cashierName:
          cashierNames[
            shift.cashier_id
          ] || "Caissier",
        orderCount:
          shiftOrders.length,
        total,
        payments,
      };
    });

  const openShifts =
    shiftSummaries.filter(
      (shift) =>
        shift.status === "open"
    );

  const closedShifts =
    shiftSummaries.filter(
      (shift) =>
        shift.status === "closed"
    );

  const totalRevenue =
    shiftSummaries.reduce(
      (sum, shift) =>
        sum + shift.total,
      0
    );

  const totalOrders =
    shiftSummaries.reduce(
      (sum, shift) =>
        sum +
        shift.orderCount,
      0
    );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-sky-600"
          >
            ← Retour à
            l&apos;administration
          </Link>

          <h1 className="mt-2 text-3xl font-bold">
            Shifts
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Suivi des caissiers et
            des clôtures de caisse.
          </p>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/admin/shifts?period=today"
            className={
              selectedPeriod ===
              "today"
                ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Aujourd&apos;hui
          </Link>

          <Link
            href="/admin/shifts?period=week"
            className={
              selectedPeriod ===
              "week"
                ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Cette semaine
          </Link>

          <Link
            href="/admin/shifts?period=month"
            className={
              selectedPeriod ===
              "month"
                ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Ce mois
          </Link>

          <Link
            href="/admin/shifts?period=all"
            className={
              selectedPeriod ===
              "all"
                ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Tout
          </Link>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Shifts ouverts
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {openShifts.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Commandes
            </p>

            <p className="mt-2 text-2xl font-bold">
              {totalOrders}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-2 text-2xl font-bold">
              {totalRevenue} MRU
            </p>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">
            Shifts en cours
          </h2>

          {openShifts.length ===
          0 ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Aucun shift
                actuellement ouvert.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {openShifts.map(
                (shift) => (
                  <div
                    key={shift.id}
                    className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">
                          {
                            shift.cashierName
                          }
                        </p>

                        <p className="mt-1 text-sm text-emerald-600">
                          Shift ouvert
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        En cours
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Commandes
                        </p>

                        <p className="mt-1 font-bold">
                          {
                            shift.orderCount
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Total
                        </p>

                        <p className="mt-1 font-bold">
                          {
                            shift.total
                          }{" "}
                          MRU
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Durée
                        </p>

                        <p className="mt-1 font-bold">
                          {formatDuration(
                            shift.started_at,
                            null
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-500">
                      Ouvert le{" "}
                      {new Date(
                        shift.started_at
                      ).toLocaleString(
                        "fr-FR",
                        {
                          day: "2-digit",
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

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {paymentMethods.map(
                        (method) => (
                          <div
                            key={
                              method
                            }
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <p className="text-xs text-slate-500">
                              {method}
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                              {
                                shift
                                  .payments[
                                  method
                                ]
                              }{" "}
                              MRU
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">
            Shifts clôturés
          </h2>

          {closedShifts.length ===
          0 ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Aucun shift clôturé
                sur cette période.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {closedShifts.map(
                (shift) => (
                  <div
                    key={shift.id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-semibold">
                            {
                              shift.cashierName
                            }
                          </p>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            Clôturé
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {new Date(
                            shift.started_at
                          ).toLocaleString(
                            "fr-FR",
                            {
                              day: "2-digit",
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
                          {" → "}
                          {shift.ended_at
                            ? new Date(
                                shift.ended_at
                              ).toLocaleString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month:
                                    "2-digit",
                                  year:
                                    "numeric",
                                  hour:
                                    "2-digit",
                                  minute:
                                    "2-digit",
                                }
                              )
                            : "—"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Durée :{" "}
                          {formatDuration(
                            shift.started_at,
                            shift.ended_at
                          )}
                        </p>
                      </div>

                      <div className="flex gap-6">
                        <div>
                          <p className="text-xs text-slate-500">
                            Commandes
                          </p>

                          <p className="mt-1 text-lg font-bold">
                            {
                              shift.orderCount
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Total
                          </p>

                          <p className="mt-1 text-lg font-bold">
                            {
                              shift.total
                            }{" "}
                            MRU
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {paymentMethods.map(
                        (method) => (
                          <div
                            key={
                              method
                            }
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <p className="text-xs text-slate-500">
                              {method}
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                              {
                                shift
                                  .payments[
                                  method
                                ]
                              }{" "}
                              MRU
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}