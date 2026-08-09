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

export default async function AdminPage() {
  const { start, end } =
    getBusinessDayRange();

  const {
    data: todayOrders,
    error: ordersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      total,
      payment_method,
      paid_at,
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
    });

  const {
    data: openShifts,
    error: shiftsError,
  } = await supabaseAdmin
    .from("shifts")
    .select("id")
    .eq("status", "open");

  const orders =
    ordersError || !todayOrders
      ? []
      : todayOrders;

  const shifts =
    shiftsError || !openShifts
      ? []
      : openShifts;

  const totalSales = orders.reduce(
    (sum, order) =>
      sum + Number(order.total || 0),
    0
  );

  const orderCount = orders.length;

  const averageOrder =
    orderCount > 0
      ? Math.round(
          totalSales / orderCount
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
    if (!order.payment_method) {
      continue;
    }

    paymentTotals[
      order.payment_method
    ] =
      (paymentTotals[
        order.payment_method
      ] || 0) +
      Number(order.total || 0);
  }

  const recentOrders =
    orders.slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Gestion du restaurant
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Journée commerciale :
              07h00 → 07h00
            </p>
          </div>

          <LogoutButton />
        </header>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">
            Aujourd&apos;hui
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Chiffre d&apos;affaires
              </p>

              <p className="mt-2 text-2xl font-bold">
                {totalSales} MRU
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Commandes payées
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

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Shifts ouverts
              </p>

              <p className="mt-2 text-2xl font-bold">
                {shifts.length}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">
              Paiements
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Répartition des ventes de
              la journée
            </p>

            <div className="mt-5 space-y-3">
              {paymentMethods.map(
                (method) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span>
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

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Dernières ventes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Les derniers
                  encaissements
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentOrders.length ===
                0 && (
                <p className="text-sm text-slate-500">
                  Aucune vente
                  enregistrée.
                </p>
              )}

              {recentOrders.map(
                (order) => {
                  const table =
                    Array.isArray(
                      order.restaurant_tables
                    )
                      ? order
                          .restaurant_tables[0]
                      : order.restaurant_tables;

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between border-b pb-3 last:border-b-0"
                    >
                      <div>
                        <p className="font-medium">
                          {table?.name ||
                            "Table"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {order.payment_method ||
                            "Paiement"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
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
                            : ""}
                        </p>
                      </div>

                      <p className="font-semibold">
                        {order.total} MRU
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold">
            Gestion
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/users"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">
                Utilisateurs
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Créer et gérer les accès
                des employés.
              </p>
            </Link>

            <Link
              href="/admin/tables"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">
                Tables
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Vue des tables et de leur
                statut.
              </p>
            </Link>

            <Link
              href="/admin/sales"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">
                Ventes
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Historique détaillé des
                ventes et paiements.
              </p>
            </Link>

            <Link
              href="/admin/shifts"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">
                Shifts
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Suivi des shifts et des
                caissiers.
              </p>
            </Link>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">
                Stock
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Consultation des stocks
                et alertes.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">
                Rapports
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Indicateurs et analyses
                du restaurant.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}