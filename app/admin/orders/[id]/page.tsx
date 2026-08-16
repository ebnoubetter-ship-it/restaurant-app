import Link from "next/link";
import { notFound } from "next/navigation";
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

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString(
    "fr-FR",
    {
      timeZone:
        "Africa/Nouakchott",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

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

      restaurant_tables!orders_table_id_fkey (
        name,
        zone
      ),

      order_items (
        id,
        quantity,
        unit_price,
        sent_quantity,
        cancelled_quantity,
        cancelled_after_send_quantity,

        menu_items (
          name,
          category
        )
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !order
  ) {
    notFound();
  }

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
      Boolean(value)
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
        ) || "Caissier"
      : "—";

  const cancelledByName =
    order.cancelled_by
      ? usersMap.get(
          order.cancelled_by
        ) || "Caissier"
      : "—";

  /*
   * ============================
   * TABLE / EMPLACEMENT
   * ============================
   */
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

  /*
   * ============================
   * ARTICLES
   * ============================
   */
  const items =
    order.order_items ||
    [];

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
   * Regroupement des
   * annulations par article.
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
        (cancellation.after_kitchen
          ? Number(
              cancellation.quantity ||
                0
            )
          : 0),
      0
    );

  /*
   * ============================
   * STATUT COMMANDE
   * ============================
   */
  const getStatusLabel =
    () => {
      if (
        order.status ===
        "paid"
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

  /*
   * ============================
   * ÉTAT CUISINE
   * ============================
   */
  let kitchenLabel =
    "Non envoyée";

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
        "Envoyée avant annulation";

      kitchenStyle =
        "bg-[#FFF1EE] text-[#A74435]";
    } else {
      kitchenLabel =
        "Annulée avant envoi";

      kitchenStyle =
        "bg-[#FFF6E9] text-[#946021]";
    }
  } else if (
    totalCurrentUnits ===
    0
  ) {
    kitchenLabel =
      "Commande vide";

    kitchenStyle =
      "bg-[#F1F2EF] text-[#68706B]";
  } else if (
    pendingKitchenUnits >
    0
  ) {
    kitchenLabel =
      `${pendingKitchenUnits} à envoyer`;

    kitchenStyle =
      "bg-[#FFF6E9] text-[#946021]";
  } else {
    kitchenLabel =
      "Cuisine OK";

    kitchenStyle =
      "bg-[#EDF5EF] text-[#2E6A50]";
  }

  const totalLabel =
    order.status ===
    "paid"
      ? "Total encaissé"
      : order.status ===
          "cancelled"
        ? "Valeur restante"
        : "Total actuel";

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* HEADER MAIDA */}
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
          </div>
        </header>

        {/* IDENTITÉ COMMANDE */}
        <section className="rounded-[28px] border border-[#E8E5DE] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2E6A50]">
                Détail de la
                commande
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
                  {orderLabel}
                </h1>

                {order.order_number && (
                  <span className="rounded-full bg-[#F1F2EF] px-3 py-1.5 text-sm font-bold text-[#68706B]">
                    #
                    {Number(
                      order.order_number
                    )}
                  </span>
                )}

                {order.order_type ===
                  "takeaway" && (
                  <span className="rounded-full bg-[#F3EFE8] px-3 py-1.5 text-xs font-semibold text-[#745F4F]">
                    À emporter
                  </span>
                )}
              </div>

              {order.order_type !==
                "takeaway" &&
                table?.zone && (
                  <p className="mt-2 text-sm text-[#7A817C]">
                    Zone :{" "}
                    <span className="font-semibold text-[#4E5651]">
                      {
                        table.zone
                      }
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

        {/* ANNULATION COMPLÈTE */}
        {order.status ===
          "cancelled" && (
          <section className="mt-4 rounded-[24px] border border-[#EDC7C0] bg-[#FFF7F5] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#A74435]">
              Commande annulée
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#A87870]">
                  Motif
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {order.cancellation_reason ||
                    "Autre"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#A87870]">
                  Annulée par
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {
                    cancelledByName
                  }
                </p>
              </div>

              <div>
                <p className="text-xs text-[#A87870]">
                  Date
                </p>

                <p className="mt-1 font-semibold text-[#713E35]">
                  {formatDateTime(
                    order.cancelled_at
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* INFORMATIONS */}
        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              Caissier
            </p>

            <p className="mt-2 font-bold text-[#1F2924]">
              {cashierName}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              Ouverture
            </p>

            <p className="mt-2 text-sm font-bold text-[#1F2924]">
              {formatDateTime(
                order.created_at
              )}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              Paiement
            </p>

            <p className="mt-2 font-bold text-[#1F2924]">
              {order.payment_method ||
                "—"}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-[#7A817C]">
              Encaissement
            </p>

            <p className="mt-2 text-sm font-bold text-[#1F2924]">
              {formatDateTime(
                order.paid_at
              )}
            </p>
          </div>
        </section>

        {/* PRODUITS */}
        <section className="mt-6 overflow-hidden rounded-[26px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="border-b border-[#EEECE6] p-5 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-[#1F2924]">
                  Produits
                </h2>

                <p className="mt-1 text-sm text-[#737A75]">
                  {items.length}{" "}
                  ligne
                  {items.length >
                  1
                    ? "s"
                    : ""}
                  {" · "}
                  {totalCurrentUnits}{" "}
                  article
                  {totalCurrentUnits >
                  1
                    ? "s"
                    : ""}{" "}
                  actif
                  {totalCurrentUnits >
                  1
                    ? "s"
                    : ""}
                </p>
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-medium text-[#7A817C]">
                  {totalLabel}
                </p>

                <p className="mt-1 text-2xl font-black text-[#1E4D3A]">
                  {formatMoney(
                    displayTotal
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
                Aucun produit
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                Cette commande ne
                contient aucun
                article.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEECE6]">
              {items.map(
                (item) => {
                  const product =
                    Array.isArray(
                      item.menu_items
                    )
                      ? item
                          .menu_items[0]
                      : item.menu_items;

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
                                "Produit"}
                            </h3>

                            {quantity ===
                              0 &&
                              hasCancellation && (
                                <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]">
                                  Annulé
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
                            <span className="rounded-full bg-[#F1F2EF] px-2.5 py-1 text-xs font-semibold text-[#68706B]">
                              {quantity} ×{" "}
                              {formatMoney(
                                unitPrice
                              )}{" "}
                              MRU
                            </span>

                            {sentQuantity >
                              0 && (
                              <span className="rounded-full bg-[#EDF5EF] px-2.5 py-1 text-xs font-semibold text-[#2E6A50]">
                                Cuisine :{" "}
                                {
                                  sentQuantity
                                }
                              </span>
                            )}

                            {cancellation?.beforeKitchen &&
                              cancellation.beforeKitchen >
                                0 && (
                                <span className="rounded-full bg-[#FFF6E9] px-2.5 py-1 text-xs font-semibold text-[#946021]">
                                  Annulé avant
                                  cuisine :{" "}
                                  {
                                    cancellation.beforeKitchen
                                  }
                                </span>
                              )}

                            {cancellation?.afterKitchen &&
                              cancellation.afterKitchen >
                                0 && (
                                <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-xs font-semibold text-[#A74435]">
                                  Annulé après
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
                                  Motif
                                  {cancellation.reasons
                                    .length >
                                  1
                                    ? "s"
                                    : ""}
                                </p>

                                <p className="mt-0.5 text-sm font-semibold text-[#713E35]">
                                  {cancellation.reasons.join(
                                    " · "
                                  )}
                                </p>
                              </div>
                            )}
                        </div>

                        <div className="shrink-0 sm:text-right">
                          <p className="text-xs font-medium text-[#8A918C]">
                            Sous-total
                          </p>

                          <p className="mt-1 text-lg font-black text-[#1F2924]">
                            {formatMoney(
                              lineTotal
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

              <span className="text-2xl font-black text-[#1E4D3A]">
                {formatMoney(
                  displayTotal
                )}{" "}
                <span className="text-sm font-semibold text-[#6D8274]">
                  MRU
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* HISTORIQUE ANNULATIONS ARTICLES */}
        {itemCancellations.length >
          0 && (
          <section className="mt-6 overflow-hidden rounded-[26px] border border-[#EDC7C0] bg-white shadow-sm">
            <div className="border-b border-[#F0DDD9] bg-[#FFF7F5] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#A74435]">
                    Audit
                  </p>

                  <h2 className="mt-1 text-xl font-black text-[#1F2924]">
                    Annulations
                    d&apos;articles
                  </h2>

                  <p className="mt-1 text-sm text-[#8A6B65]">
                    {
                      totalCancelledUnits
                    }{" "}
                    unité
                    {totalCancelledUnits >
                    1
                      ? "s"
                      : ""}{" "}
                    annulée
                    {totalCancelledUnits >
                    1
                      ? "s"
                      : ""}
                  </p>
                </div>

                {totalCancelledAfterKitchen >
                  0 && (
                  <span className="w-fit rounded-full bg-[#FCE4DF] px-3 py-1.5 text-xs font-semibold text-[#A74435]">
                    {
                      totalCancelledAfterKitchen
                    }{" "}
                    après cuisine
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
                    relatedItem
                      ? Array.isArray(
                          relatedItem.menu_items
                        )
                        ? relatedItem
                            .menu_items[0]
                        : relatedItem.menu_items
                      : null;

                  const cancellationCashier =
                    cancellation.cashier_id
                      ? usersMap.get(
                          cancellation.cashier_id
                        ) ||
                        "Caissier"
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
                                "Article"}
                            </p>

                            <span
                              className={
                                cancellation.after_kitchen
                                  ? "rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]"
                                  : "rounded-full bg-[#FFF6E9] px-2.5 py-1 text-[11px] font-semibold text-[#946021]"
                              }
                            >
                              {cancellation.after_kitchen
                                ? "Après cuisine"
                                : "Avant cuisine"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-[#68706B]">
                            Quantité :{" "}
                            <strong>
                              {Number(
                                cancellation.quantity ||
                                  0
                              )}
                            </strong>
                          </p>

                          <p className="mt-1 text-sm text-[#68706B]">
                            Motif :{" "}
                            <strong className="text-[#4E5651]">
                              {cancellation.reason ||
                                "Autre"}
                            </strong>
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-sm font-semibold text-[#4E5651]">
                            {
                              cancellationCashier
                            }
                          </p>

                          <p className="mt-1 text-xs text-[#9A9F9B]">
                            {formatDateTime(
                              cancellation.created_at
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

        {/* RACCOURCIS */}
        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/tables"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            Tables
          </Link>

          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            Ventes
          </Link>

          <Link
            href="/admin/reports"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3]"
          >
            Rapports
          </Link>
        </nav>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}