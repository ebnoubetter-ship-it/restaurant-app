"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
};

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  sent_quantity: number;
  cancelled_quantity: number;
  cancelled_after_send_quantity: number;
  menu_items:
    | {
        id: string;
        name: string;
        category: string;
      }
    | {
        id: string;
        name: string;
        category: string;
      }[];
};

const categories = [
  "Snacks",
  "Plats",
  "Desserts",
  "Boissons",
  "Petit-déjeuner",
  "Chicha",
];

const cancellationReasons = [
  "Client a annulé",
  "Erreur de saisie",
  "Produit indisponible",
  "Autre",
];

export default function OrderClient({
  orderId,
  tableName,
}: {
  orderId: string;
  tableName: string;
}) {
  const [menu, setMenu] =
    useState<MenuItem[]>([]);

  const [
    orderItems,
    setOrderItems,
  ] = useState<OrderItem[]>([]);

  const [category, setCategory] =
    useState("Snacks");

  const [loading, setLoading] =
    useState(true);

  const [
    addingId,
    setAddingId,
  ] = useState<string | null>(
    null
  );

  const [
    showPayment,
    setShowPayment,
  ] = useState(false);

  const [paying, setPaying] =
    useState(false);

  // ENVOI CUISINE

  const [
    sendingKitchen,
    setSendingKitchen,
  ] = useState(false);

  const [
    kitchenMessage,
    setKitchenMessage,
  ] = useState("");

  // ANNULATION COMMANDE

  const [
    showCancellation,
    setShowCancellation,
  ] = useState(false);

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [
    customCancellationReason,
    setCustomCancellationReason,
  ] = useState("");

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  // ANNULATION ARTICLE

  const [
    itemToCancel,
    setItemToCancel,
  ] = useState<OrderItem | null>(
    null
  );

  const [
    itemCancelQuantity,
    setItemCancelQuantity,
  ] = useState(1);

  const [
    itemCancellationReason,
    setItemCancellationReason,
  ] = useState("");

  const [
    customItemCancellationReason,
    setCustomItemCancellationReason,
  ] = useState("");

  const [
    cancellingItem,
    setCancellingItem,
  ] = useState(false);

  const getProduct = (
    item: OrderItem
  ) => {
    return Array.isArray(
      item.menu_items
    )
      ? item.menu_items[0]
      : item.menu_items;
  };

  const loadMenu = async () => {
    const response =
      await fetch(
        "/api/menu"
      );

    const data =
      await response.json();

    if (response.ok) {
      setMenu(data);
    }
  };

  const loadOrder = async () => {
    const response =
      await fetch(
        `/api/orders/${orderId}/items`
      );

    const data =
      await response.json();

    if (response.ok) {
      setOrderItems(data);
    }
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        loadMenu(),
        loadOrder(),
      ]);

      setLoading(false);
    };

    load();
  }, []);

  const addItem = async (
    menuItemId: string
  ) => {
    setAddingId(
      menuItemId
    );

    setKitchenMessage("");

    const response =
      await fetch(
        `/api/orders/${orderId}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            menuItemId,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Impossible d'ajouter le produit."
      );

      setAddingId(null);

      return;
    }

    await loadOrder();

    setAddingId(null);
  };

  const openItemCancellation = (
    item: OrderItem,
    quantity = 1
  ) => {
    setItemToCancel(item);

    setItemCancelQuantity(
      Math.min(
        Math.max(quantity, 1),
        item.quantity
      )
    );

    setItemCancellationReason(
      ""
    );

    setCustomItemCancellationReason(
      ""
    );
  };

  const closeItemCancellation =
    () => {
      if (cancellingItem) {
        return;
      }

      setItemToCancel(null);

      setItemCancelQuantity(
        1
      );

      setItemCancellationReason(
        ""
      );

      setCustomItemCancellationReason(
        ""
      );
    };

  const updateItem =
    async (
      itemId: string,
      action:
        | "increase"
        | "decrease"
        | "delete"
    ) => {
      setKitchenMessage("");

      const response =
        await fetch(
          `/api/orders/${orderId}/items`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              itemId,
              action,
            }),
          }
        );

      const data =
        await response.json();

      if (response.ok) {
        await loadOrder();

        return;
      }

      if (
        data.requiresCancellation
      ) {
        const item =
          orderItems.find(
            (currentItem) =>
              currentItem.id ===
              itemId
          );

        if (item) {
          openItemCancellation(
            item,
            action === "delete"
              ? item.quantity
              : 1
          );
        }

        return;
      }

      alert(
        data.error ||
          "Impossible de modifier l'article."
      );
    };

  const cancelItem =
    async () => {
      if (!itemToCancel) {
        return;
      }

      const finalReason =
        itemCancellationReason ===
        "Autre"
          ? customItemCancellationReason.trim()
          : itemCancellationReason;

      if (!finalReason) {
        alert(
          "Veuillez choisir un motif d'annulation."
        );

        return;
      }

      if (
        itemCancelQuantity < 1 ||
        itemCancelQuantity >
          itemToCancel.quantity
      ) {
        alert(
          "Quantité invalide."
        );

        return;
      }

      setCancellingItem(
        true
      );

      const response =
        await fetch(
          `/api/orders/${orderId}/items`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              itemId:
                itemToCancel.id,
              action:
                "cancel",
              cancelQuantity:
                itemCancelQuantity,
              reason:
                finalReason,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Impossible d'annuler l'article."
        );

        setCancellingItem(
          false
        );

        return;
      }

      await loadOrder();

      setCancellingItem(
        false
      );

      setItemToCancel(null);

      setItemCancelQuantity(
        1
      );

      setItemCancellationReason(
        ""
      );

      setCustomItemCancellationReason(
        ""
      );
    };

  const sendToKitchen =
    async () => {
      setSendingKitchen(
        true
      );

      setKitchenMessage(
        ""
      );

      const response =
        await fetch(
          `/api/orders/${orderId}/send-kitchen`,
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Impossible d'envoyer la commande en cuisine."
        );

        setSendingKitchen(
          false
        );

        return;
      }

      await loadOrder();

      if (
        data.type ===
        "addition"
      ) {
        setKitchenMessage(
          "Les ajouts ont été envoyés en cuisine."
        );
      } else {
        setKitchenMessage(
          "La commande a été envoyée en cuisine."
        );
      }

      setSendingKitchen(
        false
      );
    };

  const payOrder = async (
    paymentMethod: string
  ) => {
    setPaying(true);

    const response =
      await fetch(
        `/api/orders/${orderId}/pay`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            paymentMethod,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Paiement impossible."
      );

      setPaying(false);

      return;
    }

    window.location.href =
      "/cashier";
  };

  const cancelOrder =
    async () => {
      const finalReason =
        cancellationReason ===
        "Autre"
          ? customCancellationReason.trim()
          : cancellationReason;

      if (!finalReason) {
        alert(
          "Veuillez choisir un motif d'annulation."
        );

        return;
      }

      setCancelling(true);

      const response =
        await fetch(
          `/api/orders/${orderId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              reason:
                finalReason,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Impossible d'annuler la commande."
        );

        setCancelling(false);

        return;
      }

      window.location.href =
        "/cashier";
    };

  const filteredMenu =
    menu.filter(
      (item) =>
        item.category ===
        category
    );

  const total =
    useMemo(() => {
      return orderItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.unit_price
          ) *
            Number(
              item.quantity
            ),
        0
      );
    }, [orderItems]);

  const pendingKitchenQuantity =
    useMemo(() => {
      return orderItems.reduce(
        (sum, item) => {
          const quantity =
            Number(
              item.quantity || 0
            );

          const sentQuantity =
            Number(
              item.sent_quantity || 0
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
    }, [orderItems]);

  const hasBeenSentToKitchen =
    useMemo(() => {
      return orderItems.some(
        (item) =>
          Number(
            item.sent_quantity ||
              0
          ) > 0 ||
          Number(
            item.cancelled_after_send_quantity ||
              0
          ) > 0
      );
    }, [orderItems]);

  const allItemsSent =
    orderItems.length > 0 &&
    pendingKitchenQuantity ===
      0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Chargement de la
        commande...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/cashier"
              className="text-sm text-sky-600"
            >
              ← Retour aux tables
            </Link>

            <h1 className="mt-2 text-3xl font-bold">
              {tableName}
            </h1>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500">
              Total
            </p>

            <p className="text-3xl font-bold">
              {total} MRU
            </p>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map(
            (item) => (
              <button
                key={item}
                onClick={() =>
                  setCategory(
                    item
                  )
                }
                className={
                  category ===
                  item
                    ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                    : "whitespace-nowrap rounded-xl bg-white px-4 py-2 text-slate-700 shadow-sm"
                }
              >
                {item}
              </button>
            )
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filteredMenu.map(
                (item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      addItem(
                        item.id
                      )
                    }
                    disabled={
                      addingId ===
                      item.id
                    }
                    className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-50"
                  >
                    <p className="font-semibold">
                      {
                        item.name
                      }
                    </p>

                    <p className="mt-2 font-bold text-sky-600">
                      {
                        item.price
                      }{" "}
                      MRU
                    </p>
                  </button>
                )
              )}
            </div>
          </section>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-bold">
              Commande en cours
            </h2>

            <div className="mt-5 space-y-3">
              {orderItems.length ===
                0 && (
                <p className="text-sm text-slate-500">
                  Aucun produit
                  ajouté.
                </p>
              )}

              {orderItems.map(
                (item) => {
                  const product =
                    getProduct(
                      item
                    );

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

                  const pendingQuantity =
                    Math.max(
                      quantity -
                        sentQuantity,
                      0
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="border-b pb-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {
                              product?.name
                            }
                          </p>

                          <p className="text-sm text-slate-500">
                            {
                              item.unit_price
                            }{" "}
                            MRU /
                            unité
                          </p>

                          {sentQuantity >
                            0 && (
                            <p className="mt-1 text-xs font-medium text-emerald-600">
                              {
                                sentQuantity
                              }{" "}
                              envoyé
                              {sentQuantity >
                              1
                                ? "s"
                                : ""}{" "}
                              en cuisine
                            </p>
                          )}

                          {pendingQuantity >
                            0 && (
                            <p className="mt-1 text-xs font-medium text-amber-600">
                              {
                                pendingQuantity
                              }{" "}
                              à envoyer
                            </p>
                          )}
                        </div>

                        <p className="font-semibold">
                          {quantity *
                            Number(
                              item.unit_price
                            )}{" "}
                          MRU
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            updateItem(
                              item.id,
                              "decrease"
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border"
                        >
                          −
                        </button>

                        <span className="min-w-6 text-center font-medium">
                          {
                            quantity
                          }
                        </span>

                        <button
                          onClick={() =>
                            updateItem(
                              item.id,
                              "increase"
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border"
                        >
                          +
                        </button>

                        {sentQuantity >
                        0 ? (
                          <button
                            onClick={() =>
                              openItemCancellation(
                                item,
                                1
                              )
                            }
                            className="ml-2 text-sm font-medium text-red-600"
                          >
                            Annuler
                            article
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              updateItem(
                                item.id,
                                "delete"
                              )
                            }
                            className="ml-2 text-sm text-red-500"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">
                Total
              </span>

              <span className="text-2xl font-bold">
                {total} MRU
              </span>
            </div>

            {kitchenMessage && (
              <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                {
                  kitchenMessage
                }
              </div>
            )}

            {pendingKitchenQuantity >
            0 ? (
              <button
                onClick={
                  sendToKitchen
                }
                disabled={
                  sendingKitchen
                }
                className="mt-5 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50"
              >
                {sendingKitchen
                  ? "Envoi..."
                  : hasBeenSentToKitchen
                  ? `Envoyer les ajouts (${pendingKitchenQuantity})`
                  : "Envoyer la commande"}
              </button>
            ) : (
              allItemsSent && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
                  Commande envoyée
                  en cuisine
                </div>
              )
            )}

            {pendingKitchenQuantity >
              0 &&
              orderItems.length >
                0 && (
                <p className="mt-2 text-center text-xs text-amber-600">
                  Envoyez tous les
                  articles en cuisine
                  avant
                  l&apos;encaissement.
                </p>
              )}

            <button
              onClick={() =>
                setShowPayment(
                  true
                )
              }
              disabled={
                orderItems.length ===
                  0 ||
                pendingKitchenQuantity >
                  0 ||
                sendingKitchen
              }
              className="mt-4 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white disabled:opacity-40"
            >
              Payer
            </button>

            <button
              onClick={() =>
                setShowCancellation(
                  true
                )
              }
              className="mt-3 w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 transition hover:bg-red-50"
            >
              Annuler la commande
            </button>
          </aside>
        </div>

        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold">
                Paiement
              </h2>

              <p className="mt-2 text-slate-500">
                Total à payer
              </p>

              <p className="mt-1 text-3xl font-bold">
                {total} MRU
              </p>

              <div className="mt-6 space-y-3">
                {[
                  "Bankily",
                  "Masrivi",
                  "Sedad",
                  "BCI PAY",
                  "Cash",
                ].map(
                  (method) => (
                    <button
                      key={
                        method
                      }
                      disabled={
                        paying
                      }
                      onClick={() =>
                        payOrder(
                          method
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3 text-left font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      {
                        method
                      }
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() =>
                  setShowPayment(
                    false
                  )
                }
                disabled={
                  paying
                }
                className="mt-4 w-full py-2 text-sm text-slate-500"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {showCancellation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold">
                Annuler la commande
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                La commande restera
                enregistrée dans
                l&apos;historique.
              </p>

              <div className="mt-6 space-y-2">
                {cancellationReasons.map(
                  (reason) => (
                    <button
                      key={
                        reason
                      }
                      onClick={() =>
                        setCancellationReason(
                          reason
                        )
                      }
                      className={
                        cancellationReason ===
                        reason
                          ? "w-full rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-left font-medium text-red-700"
                          : "w-full rounded-xl border px-4 py-3 text-left font-medium hover:bg-slate-50"
                      }
                    >
                      {
                        reason
                      }
                    </button>
                  )
                )}
              </div>

              {cancellationReason ===
                "Autre" && (
                <textarea
                  value={
                    customCancellationReason
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomCancellationReason(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Précisez le motif..."
                  className="mt-4 min-h-24 w-full rounded-xl border p-3 outline-none focus:border-red-400"
                />
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowCancellation(
                      false
                    );

                    setCancellationReason(
                      ""
                    );

                    setCustomCancellationReason(
                      ""
                    );
                  }}
                  disabled={
                    cancelling
                  }
                  className="flex-1 rounded-xl border py-3 font-medium disabled:opacity-50"
                >
                  Retour
                </button>

                <button
                  onClick={
                    cancelOrder
                  }
                  disabled={
                    cancelling ||
                    !cancellationReason ||
                    (cancellationReason ===
                      "Autre" &&
                      !customCancellationReason.trim())
                  }
                  className="flex-1 rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-40"
                >
                  {cancelling
                    ? "Annulation..."
                    : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {itemToCancel && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold">
                Annuler un article
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {
                  getProduct(
                    itemToCancel
                  )?.name
                }
              </p>

              <div className="mt-5">
                <p className="text-sm font-medium text-slate-700">
                  Quantité à
                  annuler
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() =>
                      setItemCancelQuantity(
                        Math.max(
                          1,
                          itemCancelQuantity -
                            1
                        )
                      )
                    }
                    disabled={
                      itemCancelQuantity <=
                        1 ||
                      cancellingItem
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-40"
                  >
                    −
                  </button>

                  <span className="min-w-10 text-center text-xl font-bold">
                    {
                      itemCancelQuantity
                    }
                  </span>

                  <button
                    onClick={() =>
                      setItemCancelQuantity(
                        Math.min(
                          itemToCancel.quantity,
                          itemCancelQuantity +
                            1
                        )
                      )
                    }
                    disabled={
                      itemCancelQuantity >=
                        itemToCancel.quantity ||
                      cancellingItem
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-40"
                  >
                    +
                  </button>

                  <span className="text-sm text-slate-500">
                    sur{" "}
                    {
                      itemToCancel.quantity
                    }
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Motif
                </p>

                <div className="space-y-2">
                  {cancellationReasons.map(
                    (reason) => (
                      <button
                        key={
                          reason
                        }
                        onClick={() =>
                          setItemCancellationReason(
                            reason
                          )
                        }
                        disabled={
                          cancellingItem
                        }
                        className={
                          itemCancellationReason ===
                          reason
                            ? "w-full rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-left font-medium text-red-700"
                            : "w-full rounded-xl border px-4 py-3 text-left font-medium hover:bg-slate-50"
                        }
                      >
                        {
                          reason
                        }
                      </button>
                    )
                  )}
                </div>
              </div>

              {itemCancellationReason ===
                "Autre" && (
                <textarea
                  value={
                    customItemCancellationReason
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomItemCancellationReason(
                      event
                        .target
                        .value
                    )
                  }
                  disabled={
                    cancellingItem
                  }
                  placeholder="Précisez le motif..."
                  className="mt-4 min-h-24 w-full rounded-xl border p-3 outline-none focus:border-red-400 disabled:opacity-50"
                />
              )}

              {Number(
                itemToCancel.sent_quantity ||
                  0
              ) > 0 && (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  Une partie ou la
                  totalité de cet article
                  a déjà été envoyée en
                  cuisine.
                  L&apos;annulation sera
                  conservée dans
                  l&apos;historique.
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={
                    closeItemCancellation
                  }
                  disabled={
                    cancellingItem
                  }
                  className="flex-1 rounded-xl border py-3 font-medium disabled:opacity-50"
                >
                  Retour
                </button>

                <button
                  onClick={
                    cancelItem
                  }
                  disabled={
                    cancellingItem ||
                    !itemCancellationReason ||
                    (itemCancellationReason ===
                      "Autre" &&
                      !customItemCancellationReason.trim())
                  }
                  className="flex-1 rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-40"
                >
                  {cancellingItem
                    ? "Annulation..."
                    : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}