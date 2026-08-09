import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function CashierOrdersPage() {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      created_at,
      restaurant_tables (
        name
      ),
      order_items (
        quantity,
        unit_price
      )
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6">
        Impossible de charger les commandes.
      </main>
    );
  }

  const formattedOrders = (orders || []).map((order) => {
    const table = Array.isArray(order.restaurant_tables)
      ? order.restaurant_tables[0]
      : order.restaurant_tables;

    const total = (order.order_items || []).reduce(
      (sum, item) =>
        sum +
        Number(item.quantity) *
          Number(item.unit_price),
      0
    );

    return {
      id: order.id,
      tableName: table?.name || "Table",
      total,
      createdAt: order.created_at,
    };
  });

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
            Commandes ouvertes
          </h1>
        </div>

        <div className="space-y-3">
          {formattedOrders.length === 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Aucune commande ouverte.
              </p>
            </div>
          )}

          {formattedOrders.map((order) => (
            <Link
              key={order.id}
              href={`/cashier/orders/${order.id}`}
              className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="text-lg font-semibold">
                  {order.tableName}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Ouverte à{" "}
                  {new Date(
                    order.createdAt
                  ).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold">
                  {order.total} MRU
                </p>

                <p className="mt-1 text-sm text-sky-600">
                  Voir la commande
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}