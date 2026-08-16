import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export default async function CashierHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
  }>;
}) {
  const session =
    await getSession();

  const { period } =
    await searchParams;

  if (!session) {
    return null;
  }

  const selectedPeriod =
    period === "today"
      ? "today"
      : "shift";

  let currentShiftId:
    | string
    | null = null;

  if (
    selectedPeriod ===
    "shift"
  ) {
    const {
      data: currentShift,
    } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq(
        "cashier_id",
        session.id
      )
      .eq("status", "open")
      .order("started_at", {
        ascending: false,
      })
      .maybeSingle();

    currentShiftId =
      currentShift?.id ||
      null;
  }

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
        shift_id,
        order_type,
        restaurant_tables (
          name
        )
      `)
      .eq("status", "paid")
      .order("paid_at", {
        ascending: false,
      });

  if (
    selectedPeriod ===
    "shift"
  ) {
    if (currentShiftId) {
      query = query.eq(
        "shift_id",
        currentShiftId
      );
    } else {
      query = query.eq(
        "shift_id",
        "00000000-0000-0000-0000-000000000000"
      );
    }
  }

  if (
    selectedPeriod ===
    "today"
  ) {
    const now =
      new Date();

    const startOfDay =
      new Date(now);

    if (
      now.getUTCHours() <
      7
    ) {
      startOfDay.setUTCDate(
        startOfDay.getUTCDate() -
          1
      );
    }

    startOfDay.setUTCHours(
      7,
      0,
      0,
      0
    );

    const endOfDay =
      new Date(
        startOfDay
      );

    endOfDay.setUTCDate(
      endOfDay.getUTCDate() +
        1
    );

    query = query
      .gte(
        "paid_at",
        startOfDay.toISOString()
      )
      .lt(
        "paid_at",
        endOfDay.toISOString()
      );
  }

  const {
    data: orders,
    error,
  } = await query;

  if (error) {
    console.error(
      "CASHIER HISTORY ERROR:",
      error
    );

    return (
      <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
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

          <div className="mt-10 rounded-[26px] border border-[#E8E5DE] bg-white p-7 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1EE] font-bold text-[#B24D3E]">
              !
            </div>

            <h1 className="mt-4 text-xl font-bold text-[#1F2924]">
              Historique
              indisponible
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de charger
              les encaissements.
            </p>

            <a
              href="/cashier/history"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white"
            >
              Réessayer
            </a>
          </div>
        </div>
      </main>
    );
  }

  const historyOrders =
    orders || [];

  const totalSales =
    historyOrders.reduce(
      (sum, order) =>
        sum +
        Number(
          order.total || 0
        ),
      0
    );

  const averageOrder =
    historyOrders.length > 0
      ? Math.round(
          totalSales /
            historyOrders.length
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
    const order of historyOrders
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

  const activePaymentMethods =
    Object.entries(
      paymentTotals
    ).filter(
      ([, amount]) =>
        amount > 0
    );

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <header className="mb-5">
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
        </header>

        {/* NAV */}
        <nav className="mb-7 flex gap-1 rounded-2xl border border-[#E5E2DA] bg-white p-1 shadow-sm">
          <Link
            href="/cashier"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
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
            className="flex-1 rounded-xl bg-[#1E4D3A] px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            Historique
          </Link>
        </nav>

        {/* TITRE */}
        <section>
          <p className="text-sm font-semibold text-[#2E6A50]">
            Encaissements
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924]">
            Historique
          </h1>

          <p className="mt-2 text-sm text-[#737A75]">
            Retrouvez rapidement
            les commandes déjà
            encaissées.
          </p>
        </section>

        {/* FILTRES */}
        <div className="mt-5 inline-flex rounded-2xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
          <Link
            href="/cashier/history?period=shift"
            className={
              selectedPeriod ===
              "shift"
                ? "rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-sm font-semibold text-white"
                : "rounded-xl px-4 py-2.5 text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Mon shift
          </Link>

          <Link
            href="/cashier/history?period=today"
            className={
              selectedPeriod ===
              "today"
                ? "rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-sm font-semibold text-white"
                : "rounded-xl px-4 py-2.5 text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Aujourd&apos;hui
          </Link>
        </div>

        {selectedPeriod ===
          "shift" &&
          !currentShiftId && (
            <div className="mt-5 rounded-[20px] border border-[#EED3A8] bg-[#FFF6E9] p-4">
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#D4862D]" />

                <div>
                  <p className="font-semibold text-[#8D5519]">
                    Aucun shift
                    ouvert
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#956D44]">
                    Ouvrez un shift
                    pour commencer
                    un nouvel
                    historique de
                    caisse.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* KPI */}
        <section className="mt-6 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#E5E2DA] bg-white shadow-sm">
          <div className="border-r border-[#ECE9E2] p-3.5 sm:p-4">
            <p className="text-xs font-medium text-[#737A75]">
              Commandes
            </p>

            <p className="mt-2 text-xl font-black text-[#1F2924] sm:text-2xl">
              {
                historyOrders.length
              }
            </p>
          </div>

          <div className="border-r border-[#ECE9E2] p-3.5 sm:p-4">
            <p className="text-xs font-medium text-[#737A75]">
              Ticket moyen
            </p>

            <p className="mt-2 text-lg font-black text-[#1F2924] sm:text-2xl">
              {formatMoney(
                averageOrder
              )}
            </p>

            <p className="text-[10px] font-medium text-[#8A918C]">
              MRU
            </p>
          </div>

          <div className="bg-[#EDF5EF] p-3.5 sm:p-4">
            <p className="text-xs font-medium text-[#567362]">
              Total
            </p>

            <p className="mt-2 text-lg font-black text-[#1E4D3A] sm:text-2xl">
              {formatMoney(
                totalSales
              )}
            </p>

            <p className="text-[10px] font-medium text-[#6D8274]">
              MRU
            </p>
          </div>
        </section>

        {/* PAIEMENTS */}
        {activePaymentMethods.length >
          0 && (
          <section className="mt-5 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#343D38]">
              Paiements
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {activePaymentMethods.map(
                ([
                  method,
                  amount,
                ]) => (
                  <div
                    key={
                      method
                    }
                    className="rounded-xl bg-[#F6F6F2] px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-[#7A817C]">
                      {method}
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-[#1F2924]">
                      {formatMoney(
                        amount
                      )}{" "}
                      MRU
                    </p>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* LISTE */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1F2924]">
              Encaissements
            </h2>

            <span className="text-xs font-medium text-[#8A918C]">
              {
                historyOrders.length
              }{" "}
              résultat
              {historyOrders.length >
              1
                ? "s"
                : ""}
            </span>
          </div>

          {historyOrders.length ===
          0 ? (
            <div className="rounded-[26px] border border-[#E8E5DE] bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                —
              </div>

              <h3 className="mt-4 font-bold text-[#343D38]">
                Aucun encaissement
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#8A918C]">
                Les commandes
                payées apparaîtront
                ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {historyOrders.map(
                (order) => {
                  const table =
                    Array.isArray(
                      order.restaurant_tables
                    )
                      ? order
                          .restaurant_tables[0]
                      : order.restaurant_tables;

                  const orderLabel =
                    order.order_type ===
                    "takeaway"
                      ? "À emporter"
                      : table?.name ||
                        "Table";

                  return (
                    <article
                      key={order.id}
                      className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
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
                                À emporter
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7A817C]">
                            <span className="rounded-full bg-[#F3F4F1] px-2.5 py-1 font-semibold text-[#5F6862]">
                              {order.payment_method ||
                                "Paiement"}
                            </span>

                            {order.paid_at && (
                              <span>
                                {new Date(
                                  order.paid_at
                                ).toLocaleString(
                                  "fr-FR",
                                  {
                                    day:
                                      "2-digit",
                                    month:
                                      "2-digit",
                                    hour:
                                      "2-digit",
                                    minute:
                                      "2-digit",
                                  }
                                )}
                              </span>
                            )}
                          </div>
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
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Caisse
          </p>
        </footer>
      </div>
    </main>
  );
}