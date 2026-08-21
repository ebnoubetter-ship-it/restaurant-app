import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
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

export default async function CashierOrdersPage() {
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
    "cashier"
  ) {
    redirect("/unauthorized");
  }

  const restaurantId =
    access.restaurant.id;

  const {
    data: orders,
    error,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      created_at,
      order_type,
      restaurant_tables (
        name
      ),
      order_items (
        quantity,
        unit_price,
        sent_quantity
      )
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "status",
      "open"
    )
    .eq(
      "order_items.restaurant_id",
      restaurantId
    )
    .eq(
      "restaurant_tables.restaurant_id",
      restaurantId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    console.error(
      "CASHIER ORDERS ERROR:",
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
              Commandes indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de charger
              les commandes ouvertes.
            </p>

            <a
              href="/cashier/orders"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white"
            >
              Réessayer
            </a>
          </div>
        </div>
      </main>
    );
  }

  const formattedOrders = (
    orders || []
  ).map((order) => {
    const table = Array.isArray(
      order.restaurant_tables
    )
      ? order.restaurant_tables[0]
      : order.restaurant_tables;

    const items =
      order.order_items || [];

    const total =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ) *
            Number(
              item.unit_price || 0
            ),
        0
      );

    const totalUnits =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );

    const pendingKitchenQuantity =
      items.reduce(
        (sum, item) => {
          const quantity =
            Number(
              item.quantity || 0
            );

          const sentQuantity =
            Number(
              item.sent_quantity ||
                0
            );

          return (
            sum +
            Math.max(
              quantity -
                sentQuantity,
              0
            )
          );
        },
        0
      );

    const hasSentItems =
      items.some(
        (item) =>
          Number(
            item.sent_quantity ||
              0
          ) > 0
      );

    const orderLabel =
      order.order_type ===
      "takeaway"
        ? "À emporter"
        : table?.name ||
          "Table";

    let kitchenState:
      | "empty"
      | "pending"
      | "addition"
      | "ready" =
      "empty";

    if (totalUnits > 0) {
      if (
        pendingKitchenQuantity >
          0 &&
        hasSentItems
      ) {
        kitchenState =
          "addition";
      } else if (
        pendingKitchenQuantity >
        0
      ) {
        kitchenState =
          "pending";
      } else {
        kitchenState =
          "ready";
      }
    }

    return {
      id: order.id,

      orderNumber:
        order.order_number
          ? Number(
              order.order_number
            )
          : null,

      orderLabel,

      orderType:
        order.order_type,

      total,

      totalUnits,

      pendingKitchenQuantity,

      createdAt:
        order.created_at,

      kitchenState,
    };
  });

  const pendingCount =
    formattedOrders.filter(
      (order) =>
        order.kitchenState ===
          "pending" ||
        order.kitchenState ===
          "addition"
    ).length;

  const readyCount =
    formattedOrders.filter(
      (order) =>
        order.kitchenState ===
        "ready"
    ).length;

  const emptyCount =
    formattedOrders.filter(
      (order) =>
        order.kitchenState ===
        "empty"
    ).length;

  const getStateBadge = (
    state:
      | "empty"
      | "pending"
      | "addition"
      | "ready",
    pendingQuantity: number
  ) => {
    if (state === "ready") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5EF] px-2.5 py-1 text-xs font-semibold text-[#2E6A50]">
          <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />
          Cuisine OK
        </span>
      );
    }

    if (
      state === "addition"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E9] px-2.5 py-1 text-xs font-semibold text-[#9A5A18]">
          <span className="h-2 w-2 rounded-full bg-[#D4862D]" />
          {pendingQuantity} ajout
          {pendingQuantity > 1
            ? "s"
            : ""}{" "}
          à envoyer
        </span>
      );
    }

    if (
      state === "pending"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E9] px-2.5 py-1 text-xs font-semibold text-[#9A5A18]">
          <span className="h-2 w-2 rounded-full bg-[#D4862D]" />
          À envoyer
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F2EF] px-2.5 py-1 text-xs font-semibold text-[#7A817C]">
        <span className="h-2 w-2 rounded-full bg-[#AAB0AC]" />
        Vide
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
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

        <nav className="mb-7 flex gap-1 rounded-2xl border border-[#E5E2DA] bg-white p-1 shadow-sm">
          <Link
            href="/cashier"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            Tables
          </Link>

          <Link
            href="/cashier/orders"
            className="flex-1 rounded-xl bg-[#1E4D3A] px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            Commandes
          </Link>

          <Link
            href="/cashier/history"
            className="flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
          >
            Historique
          </Link>
        </nav>

        <section className="mb-5">
          <p className="text-sm font-semibold text-[#2E6A50]">
            Service en cours
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924]">
            Commandes ouvertes
          </h1>

          <p className="mt-2 text-sm text-[#737A75]">
            Les commandes qui
            nécessitent encore une
            action.
          </p>
        </section>

        <section className="mb-6 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#E5E2DA] bg-white shadow-sm">
          <div className="border-r border-[#ECE9E2] px-2 py-3.5 text-center">
            <p className="text-xs font-medium text-[#737A75]">
              Ouvertes
            </p>

            <p className="mt-1 text-xl font-black text-[#1F2924]">
              {
                formattedOrders.length
              }
            </p>
          </div>

          <div className="border-r border-[#ECE9E2] px-2 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D4862D]" />

              <p className="text-xs font-medium text-[#737A75]">
                À envoyer
              </p>
            </div>

            <p className="mt-1 text-xl font-black text-[#9A5A18]">
              {pendingCount}
            </p>
          </div>

          <div className="px-2 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3D7D5E]" />

              <p className="text-xs font-medium text-[#737A75]">
                Cuisine OK
              </p>
            </div>

            <p className="mt-1 text-xl font-black text-[#1E4D3A]">
              {readyCount}
            </p>
          </div>
        </section>

        {formattedOrders.length ===
        0 ? (
          <section className="rounded-[26px] border border-[#E8E5DE] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF5EF] text-xl font-bold text-[#1E4D3A]">
              ✓
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#1F2924]">
              Aucune commande ouverte
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#7A817C]">
              Toutes les commandes
              sont actuellement
              traitées.
            </p>

            <Link
              href="/cashier"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white"
            >
              Retour aux tables
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {formattedOrders.map(
              (order) => (
                <Link
                  key={order.id}
                  href={`/cashier/orders/${order.id}`}
                  className="group block rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#CDD8CF] hover:shadow-md active:scale-[0.995] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-[#1F2924]">
                          {
                            order.orderLabel
                          }
                        </h2>

                        {order.orderNumber && (
                          <span className="text-xs font-semibold text-[#9A9F9B]">
                            #
                            {
                              order.orderNumber
                            }
                          </span>
                        )}

                        {order.orderType ===
                          "takeaway" && (
                          <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-[11px] font-semibold text-[#7D6755]">
                            À emporter
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        {getStateBadge(
                          order.kitchenState,
                          order.pendingKitchenQuantity
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8A918C]">
                        <span>
                          {order.totalUnits}{" "}
                          article
                          {order.totalUnits >
                          1
                            ? "s"
                            : ""}
                        </span>

                        <span>·</span>

                        <span>
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
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-[#1F2924] sm:text-xl">
                        {formatMoney(
                          order.total
                        )}{" "}
                        <span className="text-xs font-semibold text-[#737A75]">
                          MRU
                        </span>
                      </p>

                      <p className="mt-3 text-sm font-semibold text-[#2E6A50] transition group-hover:translate-x-0.5">
                        Ouvrir →
                      </p>
                    </div>
                  </div>
                </Link>
              )
            )}
          </section>
        )}

        {emptyCount > 0 && (
          <p className="mt-5 text-center text-xs text-[#9A9F9B]">
            {emptyCount} commande
            {emptyCount > 1
              ? "s ouvertes sont"
              : " ouverte est"}{" "}
            encore vide
            {emptyCount > 1
              ? "s"
              : ""}
            .
          </p>
        )}
      </div>
    </main>
  );
}