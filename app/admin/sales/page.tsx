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

function getBusinessDayRange() {
  const now = new Date();

  const start = new Date(now);

  if (now.getUTCHours() < 7) {
    start.setUTCDate(
      start.getUTCDate() - 1
    );
  }

  start.setUTCHours(7, 0, 0, 0);

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
  const now = new Date();

  const businessNow = new Date(now);

  if (businessNow.getUTCHours() < 7) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() - 1
    );
  }

  const day =
    businessNow.getUTCDay();

  const daysSinceMonday =
    day === 0 ? 6 : day - 1;

  const start =
    new Date(businessNow);

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
    businessNow.getUTCHours() < 7
  ) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() - 1
    );
  }

  const start = new Date(
    Date.UTC(
      businessNow.getUTCFullYear(),
      businessNow.getUTCMonth(),
      1,
      7,
      0,
      0
    )
  );

  const end = new Date(
    Date.UTC(
      businessNow.getUTCFullYear(),
      businessNow.getUTCMonth() + 1,
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
      : params.period === "month"
      ? "month"
      : params.period === "all"
      ? "all"
      : "today";

  let query = supabaseAdmin
    .from("orders")
    .select(`
      id,
      total,
      payment_method,
      paid_at,
      cashier_id,
      order_type,
      restaurant_tables (
        name
      ),
      users (
        name
      )
    `)
    .eq("status", "paid")
    .order("paid_at", {
      ascending: false,
    });

  if (
    selectedPeriod === "today"
  ) {
    const { start, end } =
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
    selectedPeriod === "week"
  ) {
    const { start, end } =
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
    selectedPeriod === "month"
  ) {
    const { start, end } =
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
            Impossible de charger
            les ventes.
          </p>
        </div>
      </main>
    );
  }

  const orders =
    sales || [];

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

  for (const order of orders) {
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
            Ventes
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Journée commerciale :
            07h00 → 07h00
          </p>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/admin/sales?period=today"
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
            href="/admin/sales?period=week"
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
            href="/admin/sales?period=month"
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
            href="/admin/sales?period=all"
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

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-2 text-2xl font-bold">
              {totalSales} MRU
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Commandes
            </p>

            <p className="mt-2 text-2xl font-bold">
              {orderCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Ticket moyen
            </p>

            <p className="mt-2 text-2xl font-bold">
              {averageOrder} MRU
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">
              Paiements
            </h2>

            <div className="mt-4 space-y-3">
              {paymentMethods.map(
                (method) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm">
                      {method}
                    </span>

                    <span className="font-semibold">
                      {paymentTotals[
                        method
                      ] || 0}{" "}
                      MRU
                    </span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-semibold">
                Détail des ventes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {orderCount} commande
                {orderCount > 1
                  ? "s"
                  : ""}
              </p>
            </div>

            {orders.length ===
            0 ? (
              <div className="p-6">
                <p className="text-slate-500">
                  Aucune vente sur cette
                  période.
                </p>
              </div>
            ) : (
              <div className="divide-y">
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
                        order.users
                      )
                        ? order.users[0]
                        : order.users;

                    const orderLabel =
                      order.order_type ===
                      "takeaway"
                        ? "À emporter"
                        : table?.name ||
                          "Table";

                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {orderLabel}
                            </p>

                            {order.order_type ===
                              "takeaway" && (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                                À emporter
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                            <span>
                              {order.payment_method ||
                                "Paiement"}
                            </span>

                            <span>
                              Caissier :{" "}
                              {cashier?.name ||
                                "—"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            {order.paid_at
                              ? new Date(
                                  order.paid_at
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
                                )
                              : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="text-xl font-bold">
                            {order.total}{" "}
                            MRU
                          </p>

                          <span className="text-sm font-medium text-sky-600">
                            Voir →
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
      </div>
    </main>
  );
}