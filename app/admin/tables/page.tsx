import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TableStatus =
  | "available"
  | "reserved"
  | "occupied";

type RestaurantTable = {
  id: string;
  name: string;
  zone: "VIP" | "Terrasse" | "Salle";
  status: TableStatus;
};

type OpenOrder = {
  id: string;
  table_id: string;
  created_at: string;
  order_items: {
    quantity: number;
    unit_price: number;
  }[];
};

function getStatusStyle(
  status: TableStatus
) {
  if (status === "occupied") {
    return "border-red-200 bg-red-50";
  }

  if (status === "reserved") {
    return "border-orange-200 bg-orange-50";
  }

  return "border-green-200 bg-green-50";
}

function getStatusBadge(
  status: TableStatus
) {
  if (status === "occupied") {
    return "bg-red-100 text-red-700";
  }

  if (status === "reserved") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-green-100 text-green-700";
}

function getStatusLabel(
  status: TableStatus
) {
  if (status === "occupied") {
    return "Occupée";
  }

  if (status === "reserved") {
    return "Réservée";
  }

  return "Disponible";
}

export default async function AdminTablesPage() {
  const {
    data: tablesData,
    error: tablesError,
  } = await supabaseAdmin
    .from("restaurant_tables")
    .select(
      "id, name, zone, status"
    )
    .order("zone", {
      ascending: true,
    })
    .order("name", {
      ascending: true,
    });

  if (tablesError) {
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
            Impossible de charger les
            tables.
          </p>
        </div>
      </main>
    );
  }

  const tables =
    (tablesData ||
      []) as RestaurantTable[];

  const {
    data: openOrdersData,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      table_id,
      created_at,
      order_items (
        quantity,
        unit_price
      )
    `)
    .eq("status", "open");

  const openOrders =
    (openOrdersData ||
      []) as OpenOrder[];

  const ordersByTable =
    new Map<
      string,
      {
        id: string;
        total: number;
        createdAt: string;
      }
    >();

  for (const order of openOrders) {
    const total =
      (
        order.order_items || []
      ).reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(
              item.unit_price
            ),
        0
      );

    ordersByTable.set(
      order.table_id,
      {
        id: order.id,
        total,
        createdAt:
          order.created_at,
      }
    );
  }

  const available =
    tables.filter(
      (table) =>
        table.status ===
        "available"
    ).length;

  const reserved =
    tables.filter(
      (table) =>
        table.status ===
        "reserved"
    ).length;

  const occupied =
    tables.filter(
      (table) =>
        table.status ===
        "occupied"
    ).length;

  const renderZone = (
    title: string,
    zone: RestaurantTable["zone"]
  ) => {
    const zoneTables =
      tables.filter(
        (table) =>
          table.zone === zone
      );

    return (
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {title}
          </h2>

          <span className="text-sm text-slate-500">
            {zoneTables.length} table
            {zoneTables.length > 1
              ? "s"
              : ""}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {zoneTables.map(
            (table) => {
              const order =
                ordersByTable.get(
                  table.id
                );

              return (
                <div
                  key={table.id}
                  className={`rounded-2xl border p-4 ${getStatusStyle(
                    table.status
                  )}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {table.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {table.zone}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadge(
                        table.status
                      )}`}
                    >
                      {getStatusLabel(
                        table.status
                      )}
                    </span>
                  </div>

                  {table.status ===
                    "occupied" &&
                    order && (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-xs text-slate-500">
                          Commande en
                          cours
                        </p>

                        <p className="mt-1 text-xl font-bold">
                          {order.total}{" "}
                          MRU
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Ouverte à{" "}
                          {new Date(
                            order.createdAt
                          ).toLocaleTimeString(
                            "fr-FR",
                            {
                              hour:
                                "2-digit",
                              minute:
                                "2-digit",
                            }
                          )}
                        </p>

                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="mt-3 inline-block text-sm font-medium text-sky-600"
                        >
                          Voir la commande
                          →
                        </Link>
                      </div>
                    )}

                  {table.status ===
                    "occupied" &&
                    !order && (
                      <p className="mt-4 text-xs text-red-600">
                        Aucune commande
                        ouverte trouvée.
                      </p>
                    )}

                  {table.status ===
                    "reserved" && (
                      <p className="mt-4 text-sm text-orange-700">
                        Table réservée.
                      </p>
                    )}

                  {table.status ===
                    "available" && (
                      <p className="mt-4 text-sm text-green-700">
                        Prête à recevoir
                        un client.
                      </p>
                    )}
                </div>
              );
            }
          )}
        </div>
      </section>
    );
  };

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
            Tables
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            État actuel des tables du
            restaurant.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Disponibles
            </p>

            <p className="mt-1 text-2xl font-bold text-green-600">
              {available}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Réservées
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-500">
              {reserved}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Occupées
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {occupied}
            </p>
          </div>
        </div>

        {renderZone(
          "VIP",
          "VIP"
        )}

        {renderZone(
          "Box Terrasse",
          "Terrasse"
        )}

        {renderZone(
          "Salle",
          "Salle"
        )}
      </div>
    </main>
  );
}