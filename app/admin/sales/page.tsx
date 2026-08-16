import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Period =
  | "today"
  | "week"
  | "month"
  | "all";

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

function getBusinessDayRange() {
  const now = new Date();

  const start = new Date(now);

  if (
    now.getUTCHours() < 7
  ) {
    start.setUTCDate(
      start.getUTCDate() - 1
    );
  }

  start.setUTCHours(
    7,
    0,
    0,
    0
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
  const now = new Date();

  const businessNow =
    new Date(now);

  if (
    businessNow.getUTCHours() <
    7
  ) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() -
        1
    );
  }

  const day =
    businessNow.getUTCDay();

  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

  const start =
    new Date(
      businessNow
    );

  start.setUTCDate(
    start.getUTCDate() -
      daysSinceMonday
  );

  start.setUTCHours(
    7,
    0,
    0,
    0
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
  const now = new Date();

  const businessNow =
    new Date(now);

  if (
    businessNow.getUTCHours() <
    7
  ) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() -
        1
    );
  }

  const start =
    new Date(
      Date.UTC(
        businessNow.getUTCFullYear(),
        businessNow.getUTCMonth(),
        1,
        7,
        0,
        0
      )
    );

  const end =
    new Date(
      Date.UTC(
        businessNow.getUTCFullYear(),
        businessNow.getUTCMonth() +
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

function getPeriodLabel(
  period: Period
) {
  if (
    period === "week"
  ) {
    return "Cette semaine";
  }

  if (
    period === "month"
  ) {
    return "Ce mois";
  }

  if (
    period === "all"
  ) {
    return "Toutes les ventes";
  }

  return "Aujourd’hui";
}

export default async function AdminSalesPage({
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

  /*
   * On garde les relations
   * Supabase explicites :
   *
   * cashier_id -> users
   * table_id -> restaurant_tables
   *
   * C'est nécessaire car orders
   * possède plusieurs relations
   * vers users.
   */
  let query =
    supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        payment_method,
        paid_at,
        cashier_id,
        order_type,

        restaurant_tables!orders_table_id_fkey (
          name
        ),

        cashier:users!orders_cashier_id_fkey (
          name
        )
      `)
      .eq(
        "status",
        "paid"
      )
      .order(
        "paid_at",
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
      getBusinessDayRange();

    query = query
      .gte(
        "paid_at",
        start.toISOString()
      )
      .lt(
        "paid_at",
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

    query = query
      .gte(
        "paid_at",
        start.toISOString()
      )
      .lt(
        "paid_at",
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

    query = query
      .gte(
        "paid_at",
        start.toISOString()
      )
      .lt(
        "paid_at",
        end.toISOString()
      );
  }

  const {
    data: sales,
    error,
  } = await query;

  if (error) {
    console.error(
      "ADMIN SALES ERROR:",
      error
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
              Ventes indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de
              récupérer les ventes
              pour le moment.
            </p>

            <a
              href="/admin/sales"
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

  const orders =
    sales || [];

  const totalSales =
    orders.reduce(
      (
        sum,
        order
      ) =>
        sum +
        Number(
          order.total || 0
        ),
      0
    );

  const orderCount =
    orders.length;

  const averageOrder =
    orderCount > 0
      ? Math.round(
          totalSales /
            orderCount
        )
      : 0;

  const paymentTotals: Record<
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
    const order of orders
  ) {
    if (
      !order.payment_method
    ) {
      continue;
    }

    paymentTotals[
      order.payment_method
    ] =
      (paymentTotals[
        order.payment_method
      ] || 0) +
      Number(
        order.total || 0
      );
  }

  const getPaymentPercentage = (
    amount: number
  ) => {
    if (
      totalSales <= 0
    ) {
      return 0;
    }

    return Math.round(
      (amount /
        totalSales) *
        100
    );
  };

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
              Encaissements
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              Ventes
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Consultez chaque
              vente et son mode de
              paiement.
            </p>
          </div>
        </header>

        {/* FILTRES */}
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
          <Link
            href="/admin/sales?period=today"
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
            href="/admin/sales?period=week"
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
            href="/admin/sales?period=month"
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
            href="/admin/sales?period=all"
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

        {/* CONTEXTE */}
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
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-3 text-3xl font-black tracking-tight">
              {formatMoney(
                totalSales
              )}{" "}
              <span className="text-base font-semibold text-white/70">
                MRU
              </span>
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Commandes
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {orderCount}
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Ventes encaissées
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Ticket moyen
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {formatMoney(
                averageOrder
              )}{" "}
              <span className="text-base font-semibold text-[#737A75]">
                MRU
              </span>
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Moyenne par vente
            </p>
          </div>
        </section>

        {/* CONTENU */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* PAIEMENTS */}
          <section className="h-fit rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-[#1F2924]">
              Paiements
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              Répartition du CA
            </p>

            <div className="mt-5 space-y-5">
              {paymentMethods.map(
                (method) => {
                  const amount =
                    paymentTotals[
                      method
                    ] || 0;

                  const percentage =
                    getPaymentPercentage(
                      amount
                    );

                  return (
                    <div
                      key={
                        method
                      }
                    >
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#343D38]">
                            {
                              method
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-[#9A9F9B]">
                            {
                              percentage
                            }
                            %
                          </p>
                        </div>

                        <p className="text-sm font-bold text-[#1F2924]">
                          {formatMoney(
                            amount
                          )}{" "}
                          MRU
                        </p>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#EEF0EC]">
                        <div
                          className="h-full rounded-full bg-[#2E6A50]"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* VENTES */}
          <section className="overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="border-b border-[#EEECE6] p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                    Détail des ventes
                  </h2>

                  <p className="mt-1 text-sm text-[#7A817C]">
                    {orderCount}{" "}
                    commande
                    {orderCount >
                    1
                      ? "s"
                      : ""}
                  </p>
                </div>

                {orderCount >
                  0 && (
                  <span className="hidden rounded-full bg-[#EDF5EF] px-3 py-1.5 text-xs font-semibold text-[#2E6A50] sm:inline-flex">
                    {
                      getPeriodLabel(
                        selectedPeriod
                      )
                    }
                  </span>
                )}
              </div>
            </div>

            {orders.length ===
            0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                  —
                </div>

                <h3 className="mt-4 font-bold text-[#343D38]">
                  Aucune vente
                </h3>

                <p className="mt-1 max-w-xs text-sm leading-6 text-[#8A918C]">
                  Aucun encaissement
                  n&apos;a été
                  enregistré sur
                  cette période.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEECE6]">
                {orders.map(
                  (order) => {
                    const table =
                      Array.isArray(
                        order.restaurant_tables
                      )
                        ? order
                            .restaurant_tables[0]
                        : order.restaurant_tables;

                    const cashier =
                      Array.isArray(
                        order.cashier
                      )
                        ? order
                            .cashier[0]
                        : order.cashier;

                    const orderLabel =
                      order.order_type ===
                      "takeaway"
                        ? "À emporter"
                        : table?.name ||
                          "Table";

                    return (
                      <Link
                        key={
                          order.id
                        }
                        href={`/admin/orders/${order.id}`}
                        className="group block p-4 transition hover:bg-[#FAFAF7] active:bg-[#F5F5F1] sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-[#1F2924] sm:text-lg">
                                {
                                  orderLabel
                                }
                              </h3>

                              {order.order_number && (
                                <span className="text-xs font-semibold text-[#9A9F9B]">
                                  #
                                  {
                                    order.order_number
                                  }
                                </span>
                              )}

                              {order.order_type ===
                                "takeaway" && (
                                <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-[11px] font-semibold text-[#7D6755]">
                                  À
                                  emporter
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#F3F4F1] px-2.5 py-1 text-xs font-semibold text-[#5F6862]">
                                {order.payment_method ||
                                  "Paiement"}
                              </span>

                              <span className="text-xs text-[#7A817C]">
                                Caissier :{" "}
                                <span className="font-semibold text-[#565E59]">
                                  {cashier?.name ||
                                    "—"}
                                </span>
                              </span>
                            </div>

                            {order.paid_at && (
                              <p className="mt-2 text-xs text-[#9A9F9B]">
                                {new Date(
                                  order.paid_at
                                ).toLocaleString(
                                  "fr-FR",
                                  {
                                    timeZone:
                                      "Africa/Nouakchott",
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
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-lg font-black text-[#1F2924] sm:text-xl">
                              {formatMoney(
                                Number(
                                  order.total ||
                                    0
                                )
                              )}
                            </p>

                            <p className="text-[10px] font-semibold text-[#8A918C]">
                              MRU
                            </p>

                            <p className="mt-3 text-sm font-semibold text-[#2E6A50] transition group-hover:translate-x-0.5">
                              Voir →
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}