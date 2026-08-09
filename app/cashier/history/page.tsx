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

  let query = supabaseAdmin
    .from("orders")
    .select(`
      id,
      total,
      payment_method,
      paid_at,
      cashier_id,
      restaurant_tables (
        name
      )
    `)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (selectedPeriod === "shift") {
    query = query.eq("cashier_id", session.id);
  }

  if (selectedPeriod === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    query = query.gte(
      "paid_at",
      startOfDay.toISOString()
    );
  }

  const { data: orders, error } = await query;

  if (error) {
    return (
      <main className="p-6">
        Impossible de charger l&apos;historique.
      </main>
    );
  }

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

        <div className="space-y-3">
          {(orders || []).length === 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Aucune commande payée.
              </p>
            </div>
          )}

          {(orders || []).map((order) => {
            const table = Array.isArray(
              order.restaurant_tables
            )
              ? order.restaurant_tables[0]
              : order.restaurant_tables;

            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {table?.name || "Table"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {order.payment_method || "Paiement"}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {order.paid_at
                      ? new Date(
                          order.paid_at
                        ).toLocaleString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </div>

                <p className="text-xl font-bold">
                  {order.total} MRU
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}