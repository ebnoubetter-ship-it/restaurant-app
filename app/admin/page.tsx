import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { supabaseAdmin } from "@/lib/supabase-admin";

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

function getBusinessDayRange() {
  const now = new Date();

  const start = new Date(now);

  if (now.getUTCHours() < 7) {
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

  const end = new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 1
  );

  return {
    start,
    end,
  };
}

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

export default async function AdminPage() {
  const { start, end } =
    getBusinessDayRange();

  const [
    ordersResult,
    shiftsResult,
    cancellationsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        payment_method,
        paid_at,
        order_type,
        restaurant_tables (
          name
        )
      `)
      .eq("status", "paid")
      .gte(
        "paid_at",
        start.toISOString()
      )
      .lt(
        "paid_at",
        end.toISOString()
      )
      .order("paid_at", {
        ascending: false,
      }),

    supabaseAdmin
      .from("shifts")
      .select(`
        id,
        started_at
      `)
      .eq("status", "open"),

    supabaseAdmin
      .from("orders")
      .select("id")
      .eq(
        "status",
        "cancelled"
      )
      .gte(
        "cancelled_at",
        start.toISOString()
      )
      .lt(
        "cancelled_at",
        end.toISOString()
      ),
  ]);

  const hasError = Boolean(
    ordersResult.error ||
      shiftsResult.error ||
      cancellationsResult.error
  );

  if (hasError) {
    console.error(
      "ADMIN DASHBOARD ERROR:",
      {
        orders:
          ordersResult.error,

        shifts:
          shiftsResult.error,

        cancellations:
          cancellationsResult.error,
      }
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

          <div className="mt-12 rounded-[24px] border border-[#E7E4DC] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4F1] text-xl font-bold text-[#B54A3A]">
              !
            </div>

            <h1 className="mt-4 text-xl font-bold text-[#1F2924]">
              Impossible de charger
              le tableau de bord
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Les informations
              n&apos;ont pas pu être
              récupérées.
            </p>

            <a
              href="/admin"
              className="mt-5 inline-flex rounded-xl bg-[#1E4D3A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#173D2F]"
            >
              Réessayer
            </a>
          </div>
        </div>
      </main>
    );
  }

  const orders =
    ordersResult.data || [];

  const shifts =
    shiftsResult.data || [];

  const cancellations =
    cancellationsResult.data || [];

  const totalSales =
    orders.reduce(
      (sum, order) =>
        sum +
        Number(
          order.total || 0
        ),
      0
    );

  const orderCount =
    orders.length;

  const cancellationCount =
    cancellations.length;

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

  const recentOrders =
    orders.slice(0, 5);

  const getPaymentPercentage = (
    amount: number
  ) => {
    if (totalSales <= 0) {
      return 0;
    }

    return Math.round(
      (amount / totalSales) *
        100
    );
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white shadow-sm">
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

            <LogoutButton />
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2E6A50]">
                Vue d&apos;ensemble
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-[#1F2924] md:text-4xl">
                Aujourd&apos;hui
              </h1>

              <p className="mt-2 text-sm text-[#737A75]">
                Journée commerciale
                de 07h00 à 07h00
              </p>
            </div>

            <div
              className={
                shifts.length > 0
                  ? "inline-flex w-fit items-center gap-2 rounded-full border border-[#CFE0D4] bg-[#EDF5EF] px-4 py-2 text-sm font-semibold text-[#2E6A50]"
                  : "inline-flex w-fit items-center gap-2 rounded-full border border-[#E1E5E2] bg-white px-4 py-2 text-sm font-semibold text-[#737A75]"
              }
            >
              <span
                className={
                  shifts.length > 0
                    ? "h-2 w-2 rounded-full bg-[#2E6A50]"
                    : "h-2 w-2 rounded-full bg-[#AAB0AC]"
                }
              />

              {shifts.length === 0
                ? "Aucun shift ouvert"
                : `${shifts.length} shift${
                    shifts.length > 1
                      ? "s"
                      : ""
                  } ouvert${
                    shifts.length > 1
                      ? "s"
                      : ""
                  }`}
            </div>
          </div>
        </header>

        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight">
              {formatMoney(
                totalSales
              )}{" "}
              <span className="text-base font-medium text-white/70">
                MRU
              </span>
            </p>

            <p className="mt-4 text-xs text-white/60">
              Ventes encaissées
              aujourd&apos;hui
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E9E6DF] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Commandes payées
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-[#1F2924]">
              {orderCount}
            </p>

            <p className="mt-4 text-xs text-[#9A9F9B]">
              Commandes
              encaissées
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E9E6DF] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Ticket moyen
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-[#1F2924]">
              {formatMoney(
                averageOrder
              )}{" "}
              <span className="text-base font-medium text-[#737A75]">
                MRU
              </span>
            </p>

            <p className="mt-4 text-xs text-[#9A9F9B]">
              Moyenne par
              commande
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E9E6DF] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#737A75]">
                  Annulations
                </p>

                <p
                  className={
                    cancellationCount >
                    0
                      ? "mt-3 text-3xl font-bold tracking-tight text-[#B54A3A]"
                      : "mt-3 text-3xl font-bold tracking-tight text-[#1F2924]"
                  }
                >
                  {
                    cancellationCount
                  }
                </p>
              </div>

              {cancellationCount >
                0 && (
                <span className="rounded-full bg-[#FFF4F1] px-2.5 py-1 text-xs font-semibold text-[#B54A3A]">
                  À vérifier
                </span>
              )}
            </div>

            <Link
              href="/admin/reports"
              className="mt-4 inline-flex text-xs font-semibold text-[#2E6A50] hover:underline"
            >
              Voir les rapports →
            </Link>
          </div>
        </section>

        {/* PAIEMENTS + DERNIÈRES VENTES */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[24px] border border-[#E9E6DF] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              Paiements
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Répartition du
              chiffre
              d&apos;affaires
            </p>

            <div className="mt-6 space-y-5">
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
                      key={method}
                    >
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#343D38]">
                            {method}
                          </p>

                          <p className="mt-0.5 text-xs text-[#9A9F9B]">
                            {
                              percentage
                            }
                            % du CA
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

          <section className="overflow-hidden rounded-[24px] border border-[#E9E6DF] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#EEECE6] p-5 md:p-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                  Dernières ventes
                </h2>

                <p className="mt-1 text-sm text-[#737A75]">
                  Encaissements les
                  plus récents
                </p>
              </div>

              <Link
                href="/admin/sales"
                className="whitespace-nowrap text-sm font-semibold text-[#2E6A50]"
              >
                Tout voir →
              </Link>
            </div>

            {recentOrders.length ===
            0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                  —
                </div>

                <p className="mt-3 font-semibold text-[#343D38]">
                  Aucune vente
                </p>

                <p className="mt-1 text-sm text-[#8A918C]">
                  Les ventes de la
                  journée apparaîtront
                  ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEECE6]">
                {recentOrders.map(
                  (order) => {
                    const table =
                      Array.isArray(
                        order.restaurant_tables
                      )
                        ? order
                            .restaurant_tables[0]
                        : order.restaurant_tables;

                    const location =
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
                        className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#FAFAF7] md:px-6"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#1F2924]">
                              {
                                location
                              }
                            </p>

                            {order.order_number && (
                              <span className="text-xs text-[#9A9F9B]">
                                #
                                {
                                  order.order_number
                                }
                              </span>
                            )}

                            {order.order_type ===
                              "takeaway" && (
                              <span className="rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[11px] font-semibold text-[#7D6755]">
                                À
                                emporter
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-[#8A918C]">
                            <span>
                              {order.payment_method ||
                                "Paiement"}
                            </span>

                            <span>
                              ·
                            </span>

                            <span>
                              {order.paid_at
                                ? new Date(
                                    order.paid_at
                                  ).toLocaleTimeString(
                                    "fr-FR",
                                    {
                                      hour:
                                        "2-digit",
                                      minute:
                                        "2-digit",
                                    }
                                  )
                                : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <p className="font-bold text-[#1F2924]">
                            {formatMoney(
                              Number(
                                order.total ||
                                  0
                              )
                            )}{" "}
                            MRU
                          </p>

                          <span className="text-[#B4B9B5] transition group-hover:translate-x-0.5 group-hover:text-[#2E6A50]">
                            →
                          </span>
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        {/* ADMINISTRATION */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              Administration
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Accédez rapidement
              aux fonctions de
              gestion.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* RAPPORTS */}
            <Link
              href="/admin/reports"
              className="group rounded-[24px] border border-[#CFE0D4] bg-[#EDF5EF] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-sm font-bold text-white">
                  R
                </div>

                <span className="text-[#6F8F7B]">
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#1F2924]">
                Rapports
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#65726A]">
                Analyse des ventes,
                produits,
                annulations et
                shifts.
              </p>
            </Link>

            {/* VENTES */}
            <Link
              href="/admin/sales"
              className="group rounded-[24px] border border-[#E9E6DF] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D8DDD8] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F1] text-sm font-bold text-[#2E6A50]">
                  V
                </div>

                <span className="text-[#B4B9B5]">
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#1F2924]">
                Ventes
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#737A75]">
                Retrouvez chaque
                encaissement et son
                détail.
              </p>
            </Link>

            {/* SHIFTS */}
            <Link
              href="/admin/shifts"
              className="group rounded-[24px] border border-[#E9E6DF] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D8DDD8] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F1] text-sm font-bold text-[#2E6A50]">
                  S
                </div>

                <span className="text-[#B4B9B5]">
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#1F2924]">
                Shifts
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#737A75]">
                Consultez les
                horaires et
                clôtures de caisse.
              </p>
            </Link>

            {/* TABLES */}
            <Link
              href="/admin/tables"
              className="group rounded-[24px] border border-[#E9E6DF] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D8DDD8] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F1] text-sm font-bold text-[#2E6A50]">
                  T
                </div>

                <span className="text-[#B4B9B5]">
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#1F2924]">
                Tables
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#737A75]">
                Visualisez
                l&apos;occupation
                du restaurant.
              </p>
            </Link>

            {/* UTILISATEURS */}
            <Link
              href="/admin/users"
              className="group rounded-[24px] border border-[#E9E6DF] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D8DDD8] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F1] text-sm font-bold text-[#2E6A50]">
                  U
                </div>

                <span className="text-[#B4B9B5]">
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#1F2924]">
                Utilisateurs
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#737A75]">
                Gérez les employés
                et leurs accès.
              </p>
            </Link>

            {/* STOCK - À VENIR */}
            <div
              aria-disabled="true"
              className="relative cursor-default rounded-[24px] border border-dashed border-[#D9D7CF] bg-[#F9F7F2] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ECEAE4] text-sm font-bold text-[#8B8E89]">
                  S
                </div>

                <span className="rounded-full border border-[#DDD8CD] bg-white px-3 py-1 text-xs font-semibold text-[#8B806F]">
                  À venir
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#5F6561]">
                Stock
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#8A8E8A]">
                Stocks,
                approvisionnements,
                consommations et
                inventaires.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-[#E3E0D8] py-6">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Gestion de
            restaurant
          </p>
        </footer>
      </div>
    </main>
  );
}