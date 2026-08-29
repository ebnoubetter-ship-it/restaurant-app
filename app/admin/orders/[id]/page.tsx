import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  getLocale,
  getTranslations,
} from "next-intl/server";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

function getNumberLocale(
  locale: string
) {
  return locale === "ar"
    ? "ar-MR-u-nu-latn"
    : "fr-FR";
}

function formatMoney(
  value: number,
  locale: string
) {
  return new Intl.NumberFormat(
    getNumberLocale(locale),
    {
      maximumFractionDigits: 0,
      numberingSystem: "latn",
    }
  ).format(value);
}

function formatDateTime(
  value: string | null | undefined,
  locale: string
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    getNumberLocale(locale),
    {
      timeZone:
        "Africa/Nouakchott",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      numberingSystem: "latn",
    }
  ).format(
    new Date(value)
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const t =
    await getTranslations(
      "AdminOrderDetail"
    );

  const locale =
    await getLocale();

  const cancellationReasonLabel = (
    reason?: string | null
  ) => {
    const value =
      reason?.trim() ||
      "Autre";

    if (
      value ===
      "Client a annulé"
    ) {
      return t(
        "cancellationReasons.customerCancelled"
      );
    }

    if (
      value ===
      "Erreur de saisie"
    ) {
      return t(
        "cancellationReasons.inputError"
      );
    }

    if (
      value ===
      "Produit indisponible"
    ) {
      return t(
        "cancellationReasons.unavailable"
      );
    }

    if (
      value === "Autre"
    ) {
      return t(
        "cancellationReasons.other"
      );
    }

    return value;
  };

  /*
   * ============================
   * RESTAURANT + ADMIN
   * ============================
   */
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

  const { id } =
    await params;

  /*
   * ============================
   * COMMANDE
   * ============================
   */
  const {
    data: order,
    error,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total,
      payment_method,
      created_at,
      paid_at,
      cashier_id,
      cancelled_by,
      cancellation_reason,
      cancelled_at,
      sent_to_kitchen_at,
      order_type,
      table_id
    `)
    .eq(
      "id",
      id
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (
    error ||
    !order
  ) {
    notFound();
  }

  /*
   * ============================
   * TABLE
   * ============================
   */
  let table:
    | {
        name: string;
        zone: string;
      }
    | null = null;

  if (
    order.table_id
  ) {
    const {
      data: tableData,
      error: tableError,
    } = await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .select(`
        name,
        zone
      `)
      .eq(
        "id",
        order.table_id
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .maybeSingle();

    if (tableError) {
      console.error(
        "ADMIN ORDER TABLE ERROR:",
        tableError
      );
    }

    table =
      tableData || null;
  }

  /*
   * ============================
   * ARTICLES
   * ============================
   */
  const {
    data: orderItemsData,
    error: orderItemsError,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      menu_item_id,
      quantity,
      unit_price,
      sent_quantity,
      cancelled_quantity,
      cancelled_after_send_quantity
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "order_id",
      order.id
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (orderItemsError) {
    console.error(
      "ADMIN ORDER ITEMS ERROR:",
      orderItemsError
    );
  }

  const rawItems =
    orderItemsData || [];

  /*
   * ============================
   * PRODUITS
   * ============================
   */
  const menuItemIds = [
    ...new Set(
      rawItems
        .map(
          (item) =>
            item.menu_item_id
        )
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            value.length > 0
        )
    ),
  ];

  const menuItemsMap =
    new Map<
      string,
      {
        name: string;
        category: string;
      }
    >();

  if (
    menuItemIds.length >
    0
  ) {
    const {
      data: menuItems,
      error: menuItemsError,
    } = await supabaseAdmin
      .from("menu_items")
      .select(`
        id,
        name,
        category
      `)
      .eq(
        "restaurant_id",
        restaurantId
      )
      .in(
        "id",
        menuItemIds
      );

    if (menuItemsError) {
      console.error(
        "ADMIN ORDER MENU ITEMS ERROR:",
        menuItemsError
      );
    }

    for (
      const item of
      menuItems || []
    ) {
      menuItemsMap.set(
        item.id,
        {
          name:
            item.name,

          category:
            item.category,
        }
      );
    }
  }

  const items =
    rawItems.map(
      (item) => ({
        ...item,

        menu_items:
          item.menu_item_id
            ? menuItemsMap.get(
                item.menu_item_id
              ) || null
            : null,
      })
    );

  /*
   * ============================
   * ANNULATIONS D'ARTICLES
   * ============================
   */
  const {
    data:
      itemCancellationsData,
    error:
      itemCancellationsError,
  } = await supabaseAdmin
    .from(
      "order_item_cancellations"
    )
    .select(`
      id,
      order_item_id,
      quantity,
      reason,
      after_kitchen,
      cashier_id,
      created_at
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "order_id",
      order.id
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (
    itemCancellationsError
  ) {
    console.error(
      "ADMIN ORDER CANCELLATIONS ERROR:",
      itemCancellationsError
    );
  }

  const itemCancellations =
    itemCancellationsData ||
    [];

  /*
   * ============================
   * UTILISATEURS
   * ============================
   */
  const userIds = [
    order.cashier_id,
    order.cancelled_by,

    ...itemCancellations.map(
      (cancellation) =>
        cancellation.cashier_id
    ),
  ].filter(
    (
      value
    ): value is string =>
      typeof value ===
        "string" &&
      value.length > 0
  );

  const uniqueUserIds = [
    ...new Set(userIds),
  ];

  const usersMap =
    new Map<
      string,
      string
    >();

  if (
    uniqueUserIds.length >
    0
  ) {
    const {
      data: users,
      error: usersError,
    } = await supabaseAdmin
      .from("users")
      .select(
        "id, name"
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .in(
        "id",
        uniqueUserIds
      );

    if (usersError) {
      console.error(
        "ADMIN ORDER USERS ERROR:",
        usersError
      );
    }

    for (
      const user of
      users || []
    ) {
      usersMap.set(
        user.id,
        user.name
      );
    }
  }

  const cashierName =
    order.cashier_id
      ? usersMap.get(
          order.cashier_id
        ) ||
        t("cashierFallback")
      : "—";

  const cancelledByName =
    order.cancelled_by
      ? usersMap.get(
          order.cancelled_by
        ) ||
        t("cashierFallback")
      : "—";

  /*
   * ============================
   * EMPLACEMENT
   * ============================
   */
  const orderLabel =
    order.order_type ===
    "takeaway"
      ? t("order.takeaway")
      : table?.name ||
        t("order.table");

  /*
   * ============================
   * ARTICLES / TOTAL
   * ============================
   */
  const calculatedTotal =
    items.reduce(
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

  const displayTotal =
    order.status ===
    "paid"
      ? Number(
          order.total || 0
        )
      : calculatedTotal;

  const totalCurrentUnits =
    items.reduce(
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

  const pendingKitchenUnits =
    items.reduce(
      (
        sum,
        item
      ) => {
        const quantity =
          Number(
            item.quantity ||
              0
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

  /*
   * ============================
   * ANNULATIONS PAR ARTICLE
   * ============================
   */
  const cancellationsByItem =
    new Map<
      string,
      {
        total: number;
        beforeKitchen: number;
        afterKitchen: number;
        reasons: string[];
      }
    >();

  for (
    const cancellation of
    itemCancellations
  ) {
    const current =
      cancellationsByItem.get(
        cancellation.order_item_id
      ) || {
        total: 0,
        beforeKitchen: 0,
        afterKitchen: 0,
        reasons: [],
      };

    const quantity =
      Number(
        cancellation.quantity ||
          0
      );

    current.total +=
      quantity;

    if (
      cancellation.after_kitchen
    ) {
      current.afterKitchen +=
        quantity;
    } else {
      current.beforeKitchen +=
        quantity;
    }

    const reason =
      cancellation.reason?.trim();

    if (
      reason &&
      !current.reasons.includes(
        reason
      )
    ) {
      current.reasons.push(
        reason
      );
    }

    cancellationsByItem.set(
      cancellation.order_item_id,
      current
    );
  }

  const totalCancelledUnits =
    itemCancellations.reduce(
      (
        sum,
        cancellation
      ) =>
        sum +
        Number(
          cancellation.quantity ||
            0
        ),
      0
    );

  const totalCancelledAfterKitchen =
    itemCancellations.reduce(
      (
        sum,
        cancellation
      ) =>
        sum +
        (
          cancellation.after_kitchen
            ? Number(
                cancellation.quantity ||
                  0
              )
            : 0
        ),
      0
    );

  const getStatusLabel =
    () => {
      if (
        order.status ===
        "paid"
      ) {
        return t("status.paid");
      }

      if (
        order.status ===
        "cancelled"
      ) {
        return t("status.cancelled");
      }

      return t("status.open");
    };

  const getStatusStyle =
    () => {
      if (
        order.status ===
        "paid"
      ) {
        return "bg-[#E4F0E7] text-[#2E6A50]";
      }

      if (
        order.status ===
        "cancelled"
      ) {
        return "bg-[#FCE4DF] text-[#A74435]";
      }

      return "bg-[#FFF0D8] text-[#946021]";
    };

  let kitchenLabel =
    t("kitchen.notSent");

  let kitchenStyle =
    "bg-[#F1F2EF] text-[#68706B]";

  if (
    order.status ===
    "cancelled"
  ) {
    if (
      order.sent_to_kitchen_at
    ) {
      kitchenLabel =
        t("kitchen.sentBeforeCancellation");

      kitchenStyle =
        "bg-[#FFF1EE] text-[#A74435]";
    } else {
      kitchenLabel =
        t("kitchen.cancelledBeforeSend");

      kitchenStyle =
        "bg-[#FFF6E9] text-[#946021]";
    }
  } else if (
    totalCurrentUnits ===
    0
  ) {
    kitchenLabel =
      t("kitchen.emptyOrder");

    kitchenStyle =
      "bg-[#F1F2EF] text-[#68706B]";
  } else if (
    pendingKitchenUnits >
    0
  ) {
    kitchenLabel =
      t(
        "kitchen.toSend",
        {
          count:
            pendingKitchenUnits,
        }
      );

    kitchenStyle =
      "bg-[#FFF6E9] text-[#946021]";
  } else {
    kitchenLabel =
      t("kitchen.ok");

    kitchenStyle =
      "bg-[#EDF5EF] text-[#2E6A50]";
  }

  const totalLabel =
    order.status ===
    "paid"
      ? t("total.paid")
      : order.status ===
          "cancelled"
        ? t("total.remaining")
        : t("total.current");

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
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
                {t("administration")}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-[#567362]"
            >
              {t("actions.backAdmin")}
            </Link>
          </div>
        </header>

        <section className="rounded-[28px] border border-[#E8E5DE] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2E6A50]">
                {t("eyebrow")}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
                  {orderLabel}
                </h1>

                {order.order_number && (
                  <span
                    className="rounded-full bg-[#F1F2EF] px-3 py-1.5 text-sm font-bold text-[#68706B]"
                    dir="ltr"
                  >
                    #
                    {Number(
                      order.order_number
                    )}
                  </span>
                )}

                {order.order_type ===
                  "takeaway" && (
                  <span className="rounded-full bg-[#F3EFE8] px-3 py-1.5 text-xs font-semibold text-[#745F4F]">
                    {t("order.takeaway")}
                  </span>
                )}
              </div>

              {order.order_type !==
                "takeaway" &&
                table?.zone && (
                  <p className="mt-2 text-sm text-[#7A817C]">
                    {t("order.zone")} :{" "}
                    <span className="font-semibold text-[#4E5651]">
                      {table.zone === "Terrasse"
                        ? t("zones.terrace")
                        : table.zone === "Salle"
                          ? t("zones.room")
                          : table.zone}
                    </span>
                  </p>
                )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span
                className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold ${getStatusStyle()}`}
              >
                {getStatusLabel()}
              </span>

              <span
                className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold ${kitchenStyle}`}
              >
                {kitchenLabel}
              </span>
            </div>
          </div>
        </section>

        {order.status ===
          "cancelled" && (
          <section className="mt-4 rounded-[24px] border border-[#EDC7C0] bg-[#FFF7F5] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#A74435]">
              {t("cancelledOrder.title")}
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#A87870]">
                  {t("cancelledOrder.reason")}
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {cancellationReasonLabel(
                    order.cancellation_reason
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#A87870]">
                  {t("cancelledOrder.cancelledBy")}
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {
                    cancelledByName
                  }
                </p>
              </div>

              <div>
                <p className="text-xs text-[#A87870]">
                  {t("cancelledOrder.date")}
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {formatDateTime(
                    order.cancelled_at,
                    locale
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              {t("summary.cashier")}
            </p>

            <p className="mt-2 font-bold text-[#1F2924]">
              {cashierName}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              {t("summary.openedAt")}
            </p>

            <p className="mt-2 text-sm font-bold text-[#1F2924]">
              {formatDateTime(
                order.created_at,
                locale
              )}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              {t("summary.payment")}
            </p>

            <p className="mt-2 font-bold text-[#1F2924]">
              {order.payment_method ===
              "Cash"
                ? t("payments.cash")
                : order.payment_method ||
                  "—"}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              {t("summary.paidAt")}
            </p>

            <p className="mt-2 text-sm font-bold text-[#1F2924]">
              {formatDateTime(
                order.paid_at,
                locale
              )}
            </p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[26px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="border-b border-[#EEECE6] p-5 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-[#1F2924]">
                  {t("products.title")}
                </h2>

                <p className="mt-1 text-sm text-[#737A75]">
                  <span dir="ltr">
                    {items.length}
                  </span>{" "}
                  {items.length === 1
                    ? t("products.line")
                    : t("products.lines")}
                  {" · "}
                  <span dir="ltr">
                    {totalCurrentUnits}
                  </span>{" "}
                  {totalCurrentUnits === 1
                    ? t("products.activeItem")
                    : t("products.activeItems")}
                </p>
              </div>

              <div className="sm:text-end">
                <p className="text-xs font-medium text-[#7A817C]">
                  {totalLabel}
                </p>

                <p
                  className="mt-1 text-2xl font-black text-[#1E4D3A]"
                  dir="ltr"
                >
                  {formatMoney(
                    displayTotal,
                    locale
                  )}{" "}
                  <span className="text-xs font-semibold text-[#6D8274]">
                    MRU
                  </span>
                </p>
              </div>
            </div>
          </div>

          {items.length ===
          0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                —
              </div>

              <p className="mt-3 font-semibold text-[#4E5651]">
                {t("products.emptyTitle")}
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                {t("products.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEECE6]">
              {items.map(
                (item) => {
                  const product =
                    item.menu_items;

                  const quantity =
                    Number(
                      item.quantity ||
                        0
                    );

                  const unitPrice =
                    Number(
                      item.unit_price ||
                        0
                    );

                  const sentQuantity =
                    Number(
                      item.sent_quantity ||
                        0
                    );

                  const lineTotal =
                    quantity *
                    unitPrice;

                  const cancellation =
                    cancellationsByItem.get(
                      item.id
                    );

                  const hasCancellation =
                    Boolean(
                      cancellation &&
                        cancellation.total >
                          0
                    );

                  return (
                    <article
                      key={
                        item.id
                      }
                      className="p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#1F2924] sm:text-lg">
                              {product?.name ||
                                t("products.productFallback")}
                            </h3>

                            {quantity ===
                              0 &&
                              hasCancellation && (
                                <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]">
                                  {t("products.cancelled")}
                                </span>
                              )}
                          </div>

                          {product?.category && (
                            <p className="mt-1 text-xs font-medium text-[#8A918C]">
                              {
                                product.category
                              }
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className="rounded-full bg-[#F1F2EF] px-2.5 py-1 text-xs font-semibold text-[#68706B]"
                              dir="ltr"
                            >
                              {quantity} ×{" "}
                              {formatMoney(
                                unitPrice,
                                locale
                              )}{" "}
                              MRU
                            </span>

                            {sentQuantity >
                              0 && (
                              <span
                                className="rounded-full bg-[#EDF5EF] px-2.5 py-1 text-xs font-semibold text-[#2E6A50]"
                                dir="ltr"
                              >
                                {t("products.kitchen")} :{" "}
                                {
                                  sentQuantity
                                }
                              </span>
                            )}

                            {cancellation?.beforeKitchen &&
                              cancellation.beforeKitchen >
                                0 && (
                                <span
                                  className="rounded-full bg-[#FFF6E9] px-2.5 py-1 text-xs font-semibold text-[#946021]"
                                  dir="ltr"
                                >
                                  {t("products.cancelled")} avant
                                  cuisine :{" "}
                                  {
                                    cancellation.beforeKitchen
                                  }
                                </span>
                              )}

                            {cancellation?.afterKitchen &&
                              cancellation.afterKitchen >
                                0 && (
                                <span
                                  className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-xs font-semibold text-[#A74435]"
                                  dir="ltr"
                                >
                                  {t("products.cancelled")} après
                                  cuisine :{" "}
                                  {
                                    cancellation.afterKitchen
                                  }
                                </span>
                              )}
                          </div>

                          {hasCancellation &&
                            cancellation &&
                            cancellation.reasons.length >
                              0 && (
                              <div className="mt-3 rounded-xl bg-[#FFF9F7] px-3 py-2">
                                <p className="text-[11px] font-medium text-[#A87870]">
                                  {t("cancelledOrder.reason")}
                                  {cancellation.reasons
                                    .length >
                                  1
                                    ? "s"
                                    : ""}
                                </p>

                                <p className="mt-0.5 text-sm font-semibold text-[#713E35]">
                                  {cancellation.reasons
                                    .map(
                                      cancellationReasonLabel
                                    )
                                    .join(
                                      " · "
                                    )}
                                </p>
                              </div>
                            )}
                        </div>

                        <div className="shrink-0 sm:text-end">
                          <p className="text-xs font-medium text-[#8A918C]">
                            {t("products.subtotal")}
                          </p>

                          <p
                            className="mt-1 text-lg font-black text-[#1F2924]"
                            dir="ltr"
                          >
                            {formatMoney(
                              lineTotal,
                              locale
                            )}{" "}
                            <span className="text-xs font-semibold text-[#737A75]">
                              MRU
                            </span>
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          <div className="border-t border-[#EEECE6] bg-[#F7F7F3] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="text-lg font-bold text-[#343D38]">
                {totalLabel}
              </span>

              <span
                className="text-2xl font-black text-[#1E4D3A]"
                dir="ltr"
              >
                {formatMoney(
                  displayTotal,
                  locale
                )}{" "}
                <span className="text-sm font-semibold text-[#6D8274]">
                  MRU
                </span>
              </span>
            </div>
          </div>
        </section>

        {itemCancellations.length >
          0 && (
          <section className="mt-6 overflow-hidden rounded-[26px] border border-[#EDC7C0] bg-white shadow-sm">
            <div className="border-b border-[#F0DDD9] bg-[#FFF7F5] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#A74435]">
                    {t("audit.eyebrow")}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-[#1F2924]">
                    {t("audit.title")}
                  </h2>

                  <p className="mt-1 text-sm text-[#8A6B65]">
                    <span dir="ltr">
                      {
                        totalCancelledUnits
                      }
                    </span>{" "}
                    {totalCancelledUnits === 1
                      ? t("audit.cancelledUnit")
                      : t("audit.cancelledUnits")}
                  </p>
                </div>

                {totalCancelledAfterKitchen >
                  0 && (
                  <span
                    className="w-fit rounded-full bg-[#FCE4DF] px-3 py-1.5 text-xs font-semibold text-[#A74435]"
                    dir="ltr"
                  >
                    {
                      totalCancelledAfterKitchen
                    }{" "}
                    {t("audit.afterKitchen")}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-[#F0E4E1]">
              {itemCancellations.map(
                (
                  cancellation
                ) => {
                  const relatedItem =
                    items.find(
                      (item) =>
                        item.id ===
                        cancellation.order_item_id
                    );

                  const relatedProduct =
                    relatedItem?.menu_items ||
                    null;

                  const cancellationCashier =
                    cancellation.cashier_id
                      ? usersMap.get(
                          cancellation.cashier_id
                        ) ||
                        t("cashierFallback")
                      : "Caissier";

                  return (
                    <div
                      key={
                        cancellation.id
                      }
                      className="p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-[#1F2924]">
                              {relatedProduct?.name ||
                                t("products.itemFallback")}
                            </p>

                            <span
                              className={
                                cancellation.after_kitchen
                                  ? "rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]"
                                  : "rounded-full bg-[#FFF6E9] px-2.5 py-1 text-[11px] font-semibold text-[#946021]"
                              }
                            >
                              {cancellation.after_kitchen
                                ? t("audit.afterKitchen")
                                : t("audit.beforeKitchen")}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-[#68706B]">
                            {t("audit.quantity")} :{" "}
                            <strong dir="ltr">
                              {Number(
                                cancellation.quantity ||
                                  0
                              )}
                            </strong>
                          </p>

                          <p className="mt-1 text-sm text-[#68706B]">
                            {t("cancelledOrder.reason")} :{" "}
                            <strong className="text-[#4E5651]">
                              {cancellationReasonLabel(
                                cancellation.reason
                              )}
                            </strong>
                          </p>
                        </div>

                        <div className="sm:text-end">
                          <p className="text-sm font-semibold text-[#4E5651]">
                            {
                              cancellationCashier
                            }
                          </p>

                          <p className="mt-1 text-xs text-[#9A9F9B]">
                            {formatDateTime(
                              cancellation.created_at,
                              locale
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/tables"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            {t("navigation.tables")}
          </Link>

          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            {t("navigation.sales")}
          </Link>

          <Link
            href="/admin/reports"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            {t("navigation.reports")}
          </Link>
        </nav>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            {t("footer")}
          </p>
        </footer>
      </div>
    </main>
  );
}