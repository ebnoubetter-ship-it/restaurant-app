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

function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "fr-FR",
    {
      timeZone:
        "Africa/Nouakchott",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getPeriodLabel(
  period: Period
) {
  if (period === "week") {
    return "Cette semaine";
  }

  if (period === "month") {
    return "Ce mois";
  }

  if (period === "all") {
    return "Tous les shifts";
  }

  return "Aujourd’hui";
}

function getBusinessDate() {
  const now = new Date();

  const businessDate =
    new Date(now);

  if (
    now.getUTCHours() < 7
  ) {
    businessDate.setUTCDate(
      businessDate.getUTCDate() -
        1
    );
  }

  return businessDate;
}

function getTodayRange() {
  const businessDate =
    getBusinessDate();

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

  const end =
    new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 1
  );

  return {
    start,
    end,
  };
}

function getWeekRange() {
  const businessDate =
    getBusinessDate();

  const day =
    businessDate.getUTCDay();

  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

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

  const end =
    new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 7
  );

  return {
    start,
    end,
  };
}

function getMonthRange() {
  const businessDate =
    getBusinessDate();

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
      businessDate.getUTCMonth() +
        1,
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
    new Date(
      startedAt
    ).getTime();

  const end = endedAt
    ? new Date(
        endedAt
      ).getTime()
    : Date.now();

  const duration =
    Math.max(
      0,
      end - start
    );

  const totalMinutes =
    Math.floor(
      duration /
        1000 /
        60
    );

  const hours =
    Math.floor(
      totalMinutes / 60
    );

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
  const params =
    await searchParams;

  const selectedPeriod: Period =
    params.period === "week"
      ? "week"
      : params.period ===
          "month"
        ? "month"
        : params.period ===
            "all"
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
      .order(
        "started_at",
        {
          ascending: false,
        }
      );

  if (
    selectedPeriod ===
    "today"
  ) {
    const {
      start,
      end,
    } =
      getTodayRange();

    shiftsQuery =
      shiftsQuery
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
    selectedPeriod ===
    "week"
  ) {
    const {
      start,
      end,
    } =
      getWeekRange();

    shiftsQuery =
      shiftsQuery
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
    selectedPeriod ===
    "month"
  ) {
    const {
      start,
      end,
    } =
      getMonthRange();

    shiftsQuery =
      shiftsQuery
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
    console.error(
      "ADMIN SHIFTS ERROR:",
      shiftsError
    );

    return (
      <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <header className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
              M
            </div>

            <div>
              <p className="text-lg font-black tracking-[-0.03em] text-[#1F2924]">
                MAIDA
              </p>

              <p className="text-xs text-[#7A817C]">
                Administration
              </p>
            </div>
          </header>

          <div className="mt-10 rounded-[26px] border border-[#E8E5DE] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EE] text-lg font-bold text-[#B24D3E]">
              !
            </div>

            <h1 className="mt-4 text-xl font-bold text-[#1F2924]">
              Shifts indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de
              récupérer les shifts
              pour le moment.
            </p>

            <a
              href="/admin/shifts"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white"
            >
              Réessayer
            </a>

            <div>
              <Link
                href="/admin"
                className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#68706B]"
              >
                Retour à
                l&apos;administration
              </Link>
            </div>
          </div>
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

  if (
    cashierIds.length >
    0
  ) {
    const {
      data: users,
      error: usersError,
    } =
      await supabaseAdmin
        .from("users")
        .select(
          "id, name"
        )
        .in(
          "id",
          cashierIds
        );

    if (usersError) {
      console.error(
        "ADMIN SHIFTS USERS ERROR:",
        usersError
      );
    }

    cashierNames =
      (users ||
        []).reduce(
        (
          result: Record<
            string,
            string
          >,
          user
        ) => {
          result[
            user.id
          ] =
            user.name;

          return result;
        },
        {}
      );
  }

  const shiftIds =
    shifts.map(
      (shift) =>
        shift.id
    );

  let orders: {
    shift_id:
      | string
      | null;
    total: number;
    payment_method:
      | string
      | null;
  }[] = [];

  if (
    shiftIds.length >
    0
  ) {
    const {
      data: ordersData,
      error: ordersError,
    } =
      await supabaseAdmin
        .from("orders")
        .select(`
          shift_id,
          total,
          payment_method
        `)
        .eq(
          "status",
          "paid"
        )
        .in(
          "shift_id",
          shiftIds
        );

    if (ordersError) {
      console.error(
        "ADMIN SHIFTS ORDERS ERROR:",
        ordersError
      );
    }

    orders =
      (
        ordersData || []
      ).map(
        (order) => ({
          shift_id:
            order.shift_id,

          total:
            Number(
              order.total ||
                0
            ),

          payment_method:
            order.payment_method,
        })
      );
  }

  const shiftSummaries =
    shifts.map(
      (shift) => {
        const shiftOrders =
          orders.filter(
            (order) =>
              order.shift_id ===
              shift.id
          );

        const total =
          shiftOrders.reduce(
            (
              sum,
              order
            ) =>
              sum +
              Number(
                order.total ||
                  0
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

        for (
          const order of
          shiftOrders
        ) {
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
              order.total ||
                0
            );
        }

        return {
          ...shift,

          cashierName:
            cashierNames[
              shift
                .cashier_id
            ] ||
            "Caissier",

          orderCount:
            shiftOrders.length,

          total,

          payments,
        };
      }
    );

  const openShifts =
    shiftSummaries.filter(
      (shift) =>
        shift.status ===
        "open"
    );

  const closedShifts =
    shiftSummaries.filter(
      (shift) =>
        shift.status ===
        "closed"
    );

  const totalRevenue =
    shiftSummaries.reduce(
      (
        sum,
        shift
      ) =>
        sum +
        shift.total,
      0
    );

  const totalOrders =
    shiftSummaries.reduce(
      (
        sum,
        shift
      ) =>
        sum +
        shift.orderCount,
      0
    );

  const averageShiftRevenue =
    shiftSummaries.length >
    0
      ? Math.round(
          totalRevenue /
            shiftSummaries.length
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
              M
            </div>

            <div>
              <p className="text-lg font-black tracking-[-0.03em] text-[#1F2924]">
                MAIDA
              </p>

              <p className="text-xs text-[#7A817C]">
                Administration
              </p>
            </div>
          </div>

          <div className="mt-7">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-[#567362]"
            >
              ← Administration
            </Link>

            <p className="mt-3 text-sm font-semibold text-[#2E6A50]">
              Caisse
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              Shifts
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Suivez les
              caissiers, leurs
              horaires et leurs
              encaissements.
            </p>
          </div>
        </header>

        {/* FILTRES */}
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
          <Link
            href="/admin/shifts?period=today"
            className={
              selectedPeriod ===
              "today"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Aujourd&apos;hui
          </Link>

          <Link
            href="/admin/shifts?period=week"
            className={
              selectedPeriod ===
              "week"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Semaine
          </Link>

          <Link
            href="/admin/shifts?period=month"
            className={
              selectedPeriod ===
              "month"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Mois
          </Link>

          <Link
            href="/admin/shifts?period=all"
            className={
              selectedPeriod ===
              "all"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Tout
          </Link>
        </nav>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#343D38]">
            {getPeriodLabel(
              selectedPeriod
            )}
          </p>

          <p className="text-xs text-[#8A918C]">
            Journée commerciale :
            07h00 → 07h00
          </p>
        </div>

        {/* KPI */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[24px] border border-[#C7DACD] bg-[#EDF5EF] p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3D7D5E]" />

              <p className="text-sm font-medium text-[#567362]">
                En cours
              </p>
            </div>

            <p className="mt-3 text-3xl font-black text-[#1E4D3A]">
              {
                openShifts.length
              }
            </p>

            <p className="mt-3 text-xs text-[#6D8274]">
              Shift
              {openShifts.length >
              1
                ? "s"
                : ""}{" "}
              ouvert
              {openShifts.length >
              1
                ? "s"
                : ""}
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Clôturés
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {
                closedShifts.length
              }
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Sur la période
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Commandes
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {
                totalOrders
              }
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Encaissées
            </p>
          </div>

          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {formatMoney(
                totalRevenue
              )}{" "}
              <span className="text-sm font-semibold text-white/70">
                MRU
              </span>
            </p>

            <p className="mt-3 text-xs text-white/60">
              {shiftSummaries.length >
              0
                ? `${formatMoney(
                    averageShiftRevenue
                  )} MRU / shift`
                : "Aucun encaissement"}
            </p>
          </div>
        </section>

        {/* SHIFTS EN COURS */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              En cours
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Caisses actuellement
              ouvertes.
            </p>
          </div>

          {openShifts.length ===
          0 ? (
            <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-7 text-center shadow-sm">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                —
              </div>

              <p className="mt-3 font-bold text-[#343D38]">
                Aucun shift ouvert
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                Aucun caissier
                n&apos;a actuellement
                de caisse ouverte.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {openShifts.map(
                (shift) => {
                  const activePayments =
                    paymentMethods.filter(
                      (method) =>
                        shift
                          .payments[
                          method
                        ] > 0
                    );

                  return (
                    <article
                      key={
                        shift.id
                      }
                      className="overflow-hidden rounded-[26px] border border-[#C7DACD] bg-white shadow-sm"
                    >
                      <div className="border-b border-[#E3EDE6] bg-[#F5FAF6] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#3D7D5E]" />

                              <span className="text-xs font-bold uppercase tracking-wide text-[#3D7D5E]">
                                En cours
                              </span>
                            </div>

                            <h3 className="mt-2 text-xl font-black text-[#1F2924]">
                              {
                                shift.cashierName
                              }
                            </h3>

                            <p className="mt-1 text-sm text-[#667D6D]">
                              Depuis{" "}
                              {formatDateTime(
                                shift.started_at
                              )}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-[#7A817C]">
                              Durée
                            </p>

                            <p className="mt-1 font-bold text-[#1E4D3A]">
                              {formatDuration(
                                shift.started_at,
                                null
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-[#F6F6F2] p-4">
                            <p className="text-xs font-medium text-[#7A817C]">
                              Commandes
                            </p>

                            <p className="mt-1 text-2xl font-black text-[#1F2924]">
                              {
                                shift.orderCount
                              }
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#EDF5EF] p-4">
                            <p className="text-xs font-medium text-[#567362]">
                              Total
                            </p>

                            <p className="mt-1 text-xl font-black text-[#1E4D3A]">
                              {formatMoney(
                                shift.total
                              )}
                            </p>

                            <p className="text-[10px] font-semibold text-[#6D8274]">
                              MRU
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-sm font-bold text-[#343D38]">
                            Paiements
                          </p>

                          {activePayments.length ===
                          0 ? (
                            <p className="mt-2 text-sm text-[#8A918C]">
                              Aucun
                              encaissement
                              pour le
                              moment.
                            </p>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {activePayments.map(
                                (
                                  method
                                ) => (
                                  <div
                                    key={
                                      method
                                    }
                                    className="rounded-xl bg-[#F6F6F2] px-3 py-2"
                                  >
                                    <p className="text-[11px] text-[#7A817C]">
                                      {
                                        method
                                      }
                                    </p>

                                    <p className="mt-0.5 text-sm font-bold text-[#1F2924]">
                                      {formatMoney(
                                        shift
                                          .payments[
                                          method
                                        ]
                                      )}{" "}
                                      MRU
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* SHIFTS CLÔTURÉS */}
        <section className="mt-9">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              Clôturés
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Historique des caisses
              terminées.
            </p>
          </div>

          {closedShifts.length ===
          0 ? (
            <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-7 text-center shadow-sm">
              <p className="font-semibold text-[#4E5651]">
                Aucun shift clôturé
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                Aucun résultat pour
                cette période.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {closedShifts.map(
                (shift) => {
                  const activePayments =
                    paymentMethods.filter(
                      (method) =>
                        shift
                          .payments[
                          method
                        ] > 0
                    );

                  return (
                    <article
                      key={
                        shift.id
                      }
                      className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-[#1F2924]">
                              {
                                shift.cashierName
                              }
                            </h3>

                            <span className="rounded-full bg-[#F1F2EF] px-2.5 py-1 text-[11px] font-semibold text-[#737A75]">
                              Clôturé
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-[#727A75]">
                            {formatDateTime(
                              shift.started_at
                            )}
                          </p>

                          <p className="mt-1 text-sm text-[#727A75]">
                            →{" "}
                            {shift.ended_at
                              ? formatDateTime(
                                  shift.ended_at
                                )
                              : "—"}
                          </p>

                          <p className="mt-2 text-xs font-semibold text-[#8A918C]">
                            Durée :{" "}
                            {formatDuration(
                              shift.started_at,
                              shift.ended_at
                            )}
                          </p>
                        </div>

                        <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[300px]">
                          <div className="rounded-2xl bg-[#F6F6F2] p-4">
                            <p className="text-xs text-[#7A817C]">
                              Commandes
                            </p>

                            <p className="mt-1 text-xl font-black text-[#1F2924]">
                              {
                                shift.orderCount
                              }
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#EDF5EF] p-4">
                            <p className="text-xs text-[#567362]">
                              Total
                            </p>

                            <p className="mt-1 text-lg font-black text-[#1E4D3A]">
                              {formatMoney(
                                shift.total
                              )}
                            </p>

                            <p className="text-[10px] text-[#6D8274]">
                              MRU
                            </p>
                          </div>
                        </div>
                      </div>

                      {activePayments.length >
                        0 && (
                        <div className="mt-5 border-t border-[#EEECE6] pt-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#9A9F9B]">
                            Paiements
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {activePayments.map(
                              (
                                method
                              ) => (
                                <div
                                  key={
                                    method
                                  }
                                  className="rounded-xl bg-[#F6F6F2] px-3 py-2"
                                >
                                  <span className="text-xs text-[#7A817C]">
                                    {
                                      method
                                    }
                                  </span>

                                  <span className="ml-2 text-sm font-bold text-[#1F2924]">
                                    {formatMoney(
                                      shift
                                        .payments[
                                        method
                                      ]
                                    )}{" "}
                                    MRU
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}