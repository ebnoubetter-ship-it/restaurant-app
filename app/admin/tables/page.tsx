import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
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
  order_number: number | null;
  table_id: string | null;
  created_at: string;
  order_items: {
    quantity: number;
    unit_price: number;
  }[];
};

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

function formatTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleTimeString(
    "fr-FR",
    {
      timeZone:
        "Africa/Nouakchott",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getTableNumber(
  name: string
) {
  const match =
    name.match(/\d+/);

  return match
    ? Number(match[0])
    : 999999;
}

function getStatusLabel(
  status: TableStatus
) {
  if (
    status === "occupied"
  ) {
    return "Occupée";
  }

  if (
    status === "reserved"
  ) {
    return "Réservée";
  }

  return "Disponible";
}

function getStatusCardStyle(
  status: TableStatus
) {
  if (
    status === "occupied"
  ) {
    return "border-[#EDC7C0] bg-[#FFF7F5]";
  }

  if (
    status === "reserved"
  ) {
    return "border-[#EED3A8] bg-[#FFF9F0]";
  }

  return "border-[#C7DACD] bg-[#F5FAF6]";
}

function getStatusBadgeStyle(
  status: TableStatus
) {
  if (
    status === "occupied"
  ) {
    return "bg-[#FCE4DF] text-[#A74435]";
  }

  if (
    status === "reserved"
  ) {
    return "bg-[#FFF0D8] text-[#946021]";
  }

  return "bg-[#E4F0E7] text-[#2E6A50]";
}

function getStatusDotStyle(
  status: TableStatus
) {
  if (
    status === "occupied"
  ) {
    return "bg-[#C65343]";
  }

  if (
    status === "reserved"
  ) {
    return "bg-[#D4862D]";
  }

  return "bg-[#3D7D5E]";
}

export default async function AdminTablesPage() {
  const access =
    await getSessionRestaurantAccess();

  if (
    access.status ===
    "unauthenticated"
  ) {
    redirect("/login");
  }

  if (
    access.status ===
    "restricted"
  ) {
    redirect("/restricted");
  }

  if (
    access.session.role !==
    "admin"
  ) {
    redirect("/unauthorized");
  }

  const restaurantId =
    access.restaurant.id;

  const {
    data: tablesData,
    error: tablesError,
  } = await supabaseAdmin
    .from(
      "restaurant_tables"
    )
    .select(
      "id, name, zone, status"
    )
    .eq(
      "restaurant_id",
      restaurantId
    );

  if (tablesError) {
    console.error(
      "ADMIN TABLES ERROR:",
      tablesError
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
              Tables indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de récupérer
              l&apos;état des tables.
            </p>

            <a
              href="/admin/tables"
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

  const tables =
    (tablesData ||
      []) as RestaurantTable[];

  const {
    data: openOrdersData,
    error: openOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      table_id,
      created_at,
      order_items (
        quantity,
        unit_price
      )
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "order_items.restaurant_id",
      restaurantId
    )
    .eq(
      "status",
      "open"
    )
    .eq(
      "order_type",
      "dine_in"
    );

  if (openOrdersError) {
    console.error(
      "ADMIN TABLES OPEN ORDERS ERROR:",
      openOrdersError
    );
  }

  const openOrders =
    (openOrdersData ||
      []) as OpenOrder[];

  const ordersByTable =
    new Map<
      string,
      {
        id: string;
        orderNumber:
          | number
          | null;
        total: number;
        itemCount: number;
        createdAt: string;
      }
    >();

  for (
    const order of
    openOrders
  ) {
    if (
      !order.table_id
    ) {
      continue;
    }

    const total =
      (
        order.order_items ||
        []
      ).reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.quantity ||
              0
          ) *
            Number(
              item.unit_price ||
                0
            ),
        0
      );

    const itemCount =
      (
        order.order_items ||
        []
      ).reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.quantity ||
              0
          ),
        0
      );

    ordersByTable.set(
      order.table_id,
      {
        id: order.id,

        orderNumber:
          order.order_number
            ? Number(
                order.order_number
              )
            : null,

        total,

        itemCount,

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

  const occupancyRate =
    tables.length > 0
      ? Math.round(
          (occupied /
            tables.length) *
            100
        )
      : 0;

  const renderZone = (
    title: string,
    zone:
      RestaurantTable["zone"]
  ) => {
    let zoneTables =
      tables.filter(
        (table) =>
          table.zone ===
          zone
      );

    if (
      zone === "Salle"
    ) {
      zoneTables = [
        ...zoneTables,
      ].sort(
        (a, b) =>
          getTableNumber(
            a.name
          ) -
          getTableNumber(
            b.name
          )
      );
    } else {
      zoneTables = [
        ...zoneTables,
      ].sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "fr"
          )
      );
    }

    const zoneAvailable =
      zoneTables.filter(
        (table) =>
          table.status ===
          "available"
      ).length;

    const zoneReserved =
      zoneTables.filter(
        (table) =>
          table.status ===
          "reserved"
      ).length;

    const zoneOccupied =
      zoneTables.filter(
        (table) =>
          table.status ===
          "occupied"
      ).length;

    return (
      <section className="mb-9">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#1F2924]">
              {title}
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              {
                zoneTables.length
              }{" "}
              emplacement
              {zoneTables.length >
              1
                ? "s"
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5EF] px-2.5 py-1.5 font-semibold text-[#2E6A50]">
              <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />
              {
                zoneAvailable
              }{" "}
              libre
              {zoneAvailable >
              1
                ? "s"
                : ""}
            </span>

            {zoneReserved >
              0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E9] px-2.5 py-1.5 font-semibold text-[#946021]">
                <span className="h-2 w-2 rounded-full bg-[#D4862D]" />
                {
                  zoneReserved
                }{" "}
                réservée
                {zoneReserved >
                1
                  ? "s"
                  : ""}
              </span>
            )}

            {zoneOccupied >
              0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1EE] px-2.5 py-1.5 font-semibold text-[#A74435]">
                <span className="h-2 w-2 rounded-full bg-[#C65343]" />
                {
                  zoneOccupied
                }{" "}
                occupée
                {zoneOccupied >
                1
                  ? "s"
                  : ""}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {zoneTables.map(
            (table) => {
              const order =
                ordersByTable.get(
                  table.id
                );

              return (
                <article
                  key={
                    table.id
                  }
                  className={`overflow-hidden rounded-[22px] border ${getStatusCardStyle(
                    table.status
                  )}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDotStyle(
                              table.status
                            )}`}
                          />

                          <h3 className="truncate font-bold text-[#1F2924]">
                            {
                              table.name
                            }
                          </h3>
                        </div>

                        <p className="ml-[18px] mt-1 text-xs text-[#8A918C]">
                          {
                            title
                          }
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeStyle(
                          table.status
                        )}`}
                      >
                        {getStatusLabel(
                          table.status
                        )}
                      </span>
                    </div>

                    {table.status ===
                      "available" && (
                      <div className="mt-5">
                        <p className="text-sm font-semibold text-[#2E6A50]">
                          Prête à recevoir
                          un client
                        </p>
                      </div>
                    )}

                    {table.status ===
                      "reserved" && (
                      <div className="mt-5">
                        <p className="text-sm font-semibold text-[#946021]">
                          Réservation en
                          attente
                        </p>
                      </div>
                    )}
                  </div>

                  {table.status ===
                    "occupied" &&
                    order && (
                      <div className="border-t border-[#F0D8D3] bg-white/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9A6A62]">
                              Commande
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              <p className="text-xl font-black text-[#1F2924]">
                                {formatMoney(
                                  order.total
                                )}{" "}
                                <span className="text-xs font-semibold text-[#737A75]">
                                  MRU
                                </span>
                              </p>

                              {order.orderNumber && (
                                <span className="text-xs font-semibold text-[#9A9F9B]">
                                  #
                                  {
                                    order.orderNumber
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7A817C]">
                          <span>
                            {
                              order.itemCount
                            }{" "}
                            article
                            {order.itemCount >
                            1
                              ? "s"
                              : ""}
                          </span>

                          <span>
                            ·
                          </span>

                          <span>
                            Depuis{" "}
                            {formatTime(
                              order.createdAt
                            )}
                          </span>
                        </div>

                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-[#1E4D3A] px-4 text-sm font-semibold text-white transition hover:bg-[#173D2F]"
                        >
                          <span>
                            Voir la
                            commande
                          </span>

                          <span>
                            →
                          </span>
                        </Link>
                      </div>
                    )}

                  {table.status ===
                    "occupied" &&
                    !order && (
                      <div className="border-t border-[#F0D8D3] bg-[#FFF1EE] p-4">
                        <p className="text-xs font-bold text-[#A74435]">
                          État incohérent
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#A66C62]">
                          La table est
                          occupée mais
                          aucune commande
                          ouverte
                          n&apos;a été
                          trouvée.
                        </p>
                      </div>
                    )}
                </article>
              );
            }
          )}
        </div>
      </section>
    );
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
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
              Salle
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              Tables
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              État actuel du
              restaurant et
              commandes en cours.
            </p>
          </div>
        </header>

        <section className="mb-8">
          <div className="grid grid-cols-3 overflow-hidden rounded-[22px] border border-[#E5E2DA] bg-white shadow-sm">
            <div className="border-r border-[#ECE9E2] p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />

                <p className="text-xs font-medium text-[#737A75]">
                  Libres
                </p>
              </div>

              <p className="mt-2 text-2xl font-black text-[#1E4D3A]">
                {
                  available
                }
              </p>
            </div>

            <div className="border-r border-[#ECE9E2] p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D4862D]" />

                <p className="text-xs font-medium text-[#737A75]">
                  Réservées
                </p>
              </div>

              <p className="mt-2 text-2xl font-black text-[#946021]">
                {
                  reserved
                }
              </p>
            </div>

            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#C65343]" />

                <p className="text-xs font-medium text-[#737A75]">
                  Occupées
                </p>
              </div>

              <p className="mt-2 text-2xl font-black text-[#A74435]">
                {
                  occupied
                }
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#8A918C]">
              {
                tables.length
              }{" "}
              emplacement
              {tables.length >
              1
                ? "s"
                : ""}{" "}
              au total
            </p>

            <p className="text-xs font-semibold text-[#68706B]">
              Taux
              d&apos;occupation :{" "}
              <span className="text-[#A74435]">
                {
                  occupancyRate
                }
                %
              </span>
            </p>
          </div>
        </section>

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

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}