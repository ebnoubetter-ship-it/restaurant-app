import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const {
    data: order,
    error,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      total,
      payment_method,
      created_at,
      paid_at,
      cashier_id,
      order_type,
      restaurant_tables (
        name,
        zone
      ),
      order_items (
        id,
        quantity,
        unit_price,
        menu_items (
          name,
          category
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    notFound();
  }

  const table =
    Array.isArray(
      order.restaurant_tables
    )
      ? order.restaurant_tables[0]
      : order.restaurant_tables;

  const orderLabel =
    order.order_type === "takeaway"
      ? "À emporter"
      : table?.name || "Table";

  let cashierName = "—";

  if (order.cashier_id) {
    const {
      data: cashier,
    } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq(
        "id",
        order.cashier_id
      )
      .maybeSingle();

    if (cashier?.name) {
      cashierName =
        cashier.name;
    }
  }

  const items =
    order.order_items || [];

  const calculatedTotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity) *
          Number(
            item.unit_price
          ),
      0
    );

  const displayTotal =
    order.status === "paid"
      ? Number(
          order.total || 0
        )
      : calculatedTotal;

  const getStatusLabel = () => {
    if (
      order.status === "paid"
    ) {
      return "Payée";
    }

    if (
      order.status ===
      "cancelled"
    ) {
      return "Annulée";
    }

    return "Ouverte";
  };

  const getStatusStyle = () => {
    if (
      order.status === "paid"
    ) {
      return "bg-emerald-100 text-emerald-700";
    }

    if (
      order.status ===
      "cancelled"
    ) {
      return "bg-slate-200 text-slate-700";
    }

    return "bg-orange-100 text-orange-700";
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/admin/tables"
            className="text-sm text-sky-600"
          >
            ← Retour aux tables
          </Link>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Détail de la commande
              </p>

              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-3xl font-bold">
                  {orderLabel}
                </h1>

                {order.order_type ===
                  "takeaway" && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                    À emporter
                  </span>
                )}
              </div>

              {order.order_type !==
                "takeaway" &&
                table?.zone && (
                  <p className="mt-1 text-sm text-slate-500">
                    Zone :{" "}
                    {table.zone}
                  </p>
                )}
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusStyle()}`}
            >
              {getStatusLabel()}
            </span>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Caissier
            </p>

            <p className="mt-1 font-semibold">
              {cashierName}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Ouverte
            </p>

            <p className="mt-1 font-semibold">
              {new Date(
                order.created_at
              ).toLocaleString(
                "fr-FR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Paiement
            </p>

            <p className="mt-1 font-semibold">
              {order.payment_method ||
                "—"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Payée
            </p>

            <p className="mt-1 font-semibold">
              {order.paid_at
                ? new Date(
                    order.paid_at
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
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Produits
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {items.length} ligne
                  {items.length > 1
                    ? "s"
                    : ""}
                </p>
              </div>

              <p className="text-2xl font-bold">
                {displayTotal} MRU
              </p>
            </div>
          </div>

          {items.length ===
          0 ? (
            <div className="p-6">
              <p className="text-slate-500">
                Aucun produit dans
                cette commande.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map(
                (item) => {
                  const product =
                    Array.isArray(
                      item.menu_items
                    )
                      ? item
                          .menu_items[0]
                      : item.menu_items;

                  const lineTotal =
                    Number(
                      item.quantity
                    ) *
                    Number(
                      item.unit_price
                    );

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          {product?.name ||
                            "Produit"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {product?.category ||
                            ""}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            item.quantity
                          }{" "}
                          ×{" "}
                          {
                            item.unit_price
                          }{" "}
                          MRU
                        </p>
                      </div>

                      <p className="text-lg font-bold">
                        {
                          lineTotal
                        }{" "}
                        MRU
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          )}

          <div className="border-t bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">
                Total
              </span>

              <span className="text-2xl font-bold">
                {displayTotal} MRU
              </span>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <Link
            href="/admin/tables"
            className="rounded-xl border bg-white px-4 py-2 font-medium"
          >
            Retour aux tables
          </Link>
        </div>
      </div>
    </main>
  );
}