import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function CashierHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getSession();
  const { period } = await searchParams;

  if (!session) {
    return null;
  }

  const selectedPeriod =
    period === "today" ? "today" : "shift";

  let currentShiftId: string | null = null;

  if (selectedPeriod === "shift") {
    const { data: currentShift } =
      await supabaseAdmin
        .from("shifts")
        .select("id")
        .eq("cashier_id", session.id)
        .eq("status", "open")
        .order("started_at", {
          ascending: false,
        })
        .maybeSingle();

    currentShiftId =
      currentShift?.id || null;
  }

  let query = supabaseAdmin
    .from("orders")
    .select(`
      id,
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

  if (selectedPeriod === "shift") {
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

  if (selectedPeriod === "today") {
    const now = new Date();

    const startOfDay = new Date(now);

    if (now.getHours() < 7) {
      startOfDay.setDate(
        startOfDay.getDate() - 1
      );
    }

    startOfDay.setHours(
      7,
      0,
      0,
      0
    );

    const endOfDay =
      new Date(startOfDay);

    endOfDay.setDate(
      endOfDay.getDate() + 1
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
    return (
      <main className="p-6">
        Impossible de charger
        l&apos;historique.
      </main>
    );
  }

  const totalSales = (
    orders || []
  ).reduce(
    (sum, order) =>
      sum +
      Number(order.total || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/cashier"
            className="text-sm text-sky-600"
          >
            ← Retour aux tables
          </Link>

          <h1 className="mt-2 text-3xl font-bold">
            Historique
          </h1>
        </div>

        <div className="mb-6 flex gap-2">
          <Link
            href="/cashier/history?period=shift"
            className={
              selectedPeriod === "shift"
                ? "rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Mon shift
          </Link>

          <Link
            href="/cashier/history?period=today"
            className={
              selectedPeriod === "today"
                ? "rounded-xl bg-sky-500 px-4 py-2 text-white"
                : "rounded-xl bg-white px-4 py-2 shadow-sm"
            }
          >
            Aujourd&apos;hui
          </Link>
        </div>

        {selectedPeriod ===
          "shift" &&
          !currentShiftId && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-800">
                Aucun shift ouvert.
              </p>

              <p className="mt-1 text-sm text-amber-700">
                Ouvrez votre shift pour
                commencer un nouvel
                historique de caisse.
              </p>
            </div>
          )}

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Commandes
            </p>

            <p className="mt-1 text-2xl font-bold">
              {(orders || []).length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Total
            </p>

            <p className="mt-1 text-2xl font-bold">
              {totalSales} MRU
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(orders || []).length === 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Aucune commande payée.
              </p>
            </div>
          )}

          {(orders || []).map(
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
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">
                        {orderLabel}
                      </p>

                      {order.order_type ===
                        "takeaway" && (
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                          À emporter
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {order.payment_method ||
                        "Paiement"}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {order.paid_at
                        ? new Date(
                            order.paid_at
                          ).toLocaleString(
                            "fr-FR",
                            {
                              hour:
                                "2-digit",
                              minute:
                                "2-digit",
                              day:
                                "2-digit",
                              month:
                                "2-digit",
                              year:
                                "numeric",
                            }
                          )
                        : ""}
                    </p>
                  </div>

                  <p className="text-xl font-bold">
                    {order.total} MRU
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}