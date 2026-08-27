"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

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

type Feedback =
  | {
      type:
        | "success"
        | "error"
        | "warning";
      message: string;
    }
  | null;

const categories = [
  "Snacks",
  "Plats",
  "Desserts",
  "Boissons",
  "Petit-déjeuner",
  "Chicha",
];

const paymentMethods = [
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
  "Cash",
];

const cancellationReasons = [
  "Client a annulé",
  "Erreur de saisie",
  "Produit indisponible",
  "Autre",
] as const;

function Spinner({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        dark
          ? "border-[#1E4D3A]/20 border-t-[#1E4D3A]"
          : "border-white/30 border-t-white"
      }`}
    />
  );
}

export default function OrderClient({
  orderId,
  orderLabel,
  orderNumber,
}: {
  orderId: string;
  orderLabel: string;
  orderNumber: number | null;
}) {
  const router = useRouter();
  const t = useTranslations("CashierOrder");
  const locale = useLocale();

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat(
      locale === "ar" ? "ar-MR" : "fr-FR",
      {
        maximumFractionDigits: 0,
      }
    ).format(value);
  };

  const getCategoryLabel = (value: string) => {
    const labels: Record<string, string> = {
      Snacks: t("categories.snacks"),
      Plats: t("categories.dishes"),
      Desserts: t("categories.desserts"),
      Boissons: t("categories.drinks"),
      "Petit-déjeuner": t("categories.breakfast"),
      Chicha: t("categories.shisha"),
    };

    return labels[value] || value;
  };

  const getCancellationReasonLabel = (value: string) => {
    const labels: Record<string, string> = {
      "Client a annulé": t("cancellationReasons.customerCancelled"),
      "Erreur de saisie": t("cancellationReasons.inputError"),
      "Produit indisponible": t("cancellationReasons.unavailable"),
      Autre: t("cancellationReasons.other"),
    };

    return labels[value] || value;
  };

  const getPaymentLabel = (value: string) => {
    return value === "Cash" ? t("payments.cash") : value;
  };

  const [menu, setMenu] =
    useState<MenuItem[]>([]);

  const [
    orderItems,
    setOrderItems,
  ] = useState<OrderItem[]>([]);

  const [
    category,
    setCategory,
  ] = useState("Snacks");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    initialError,
    setInitialError,
  ] = useState("");

  const [
    feedback,
    setFeedback,
  ] =
    useState<Feedback>(null);

  const [
    addingId,
    setAddingId,
  ] = useState<string | null>(
    null
  );

  const [
    updatingItemId,
    setUpdatingItemId,
  ] = useState<string | null>(
    null
  );

  const [
    showMobileCart,
    setShowMobileCart,
  ] = useState(false);

  // PAIEMENT

  const [
    showPayment,
    setShowPayment,
  ] = useState(false);

  const [
    payingMethod,
    setPayingMethod,
  ] = useState<string | null>(
    null
  );

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  // CUISINE

  const [
    sendingKitchen,
    setSendingKitchen,
  ] = useState(false);

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
    cancellationError,
    setCancellationError,
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
    itemCancellationError,
    setItemCancellationError,
  ] = useState("");

  const [
    cancellingItem,
    setCancellingItem,
  ] = useState(false);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setFeedback(null);
        },
        3500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [feedback]);

  const notify = (
    type:
      | "success"
      | "error"
      | "warning",
    message: string
  ) => {
    setFeedback({
      type,
      message,
    });
  };

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
    try {
      const response =
        await fetch(
          "/api/menu",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return false;
      }

      setMenu(data);

      return true;
    } catch {
      return false;
    }
  };

  const loadOrder = async () => {
    try {
      const response =
        await fetch(
          `/api/orders/${orderId}/items`,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return false;
      }

      setOrderItems(data);

      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const load = async () => {
      const [
        menuLoaded,
        orderLoaded,
      ] = await Promise.all([
        loadMenu(),
        loadOrder(),
      ]);

      if (
        !menuLoaded ||
        !orderLoaded
      ) {
        setInitialError(
          t("errors.loadOrder")
        );
      }

      setLoading(false);
    };

    load();
  }, []);

  const refreshOrder =
    async () => {
      const success =
        await loadOrder();

      if (!success) {
        notify(
          "error",
          t("errors.refreshOrder")
        );
      }

      return success;
    };

  const addItem = async (
    menuItemId: string
  ) => {
    if (addingId) {
      return;
    }

    setAddingId(
      menuItemId
    );

    try {
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
        notify(
          "error",
          data.error ||
            t("errors.addProduct")
        );

        return;
      }

      await refreshOrder();
    } catch {
      notify(
        "error",
        t("errors.addProduct")
      );
    } finally {
      setAddingId(null);
    }
  };

  const openItemCancellation = (
    item: OrderItem,
    quantity = 1
  ) => {
    setItemToCancel(item);

    setItemCancelQuantity(
      Math.min(
        Math.max(
          quantity,
          1
        ),
        item.quantity
      )
    );

    setItemCancellationReason(
      ""
    );

    setCustomItemCancellationReason(
      ""
    );

    setItemCancellationError(
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

      setItemCancellationError(
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
      if (updatingItemId) {
        return;
      }

      setUpdatingItemId(
        itemId
      );

      try {
        const response =
          await fetch(
            `/api/orders/${orderId}/items`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  itemId,
                  action,
                }),
            }
          );

        const data =
          await response.json();

        if (response.ok) {
          await refreshOrder();

          return;
        }

        if (
          data.requiresCancellation
        ) {
          const item =
            orderItems.find(
              (
                currentItem
              ) =>
                currentItem.id ===
                itemId
            );

          if (item) {
            openItemCancellation(
              item,
              action ===
                "delete"
                ? item.quantity
                : 1
            );
          }

          return;
        }

        notify(
          "error",
          data.error ||
            t("errors.updateItem")
        );
      } catch {
        notify(
          "error",
          t("errors.updateItem")
        );
      } finally {
        setUpdatingItemId(
          null
        );
      }
    };

  const cancelItem =
    async () => {
      if (
        !itemToCancel ||
        cancellingItem
      ) {
        return;
      }

      setItemCancellationError(
        ""
      );

      const finalReason =
        itemCancellationReason ===
        "Autre"
          ? customItemCancellationReason.trim()
          : itemCancellationReason;

      if (!finalReason) {
        setItemCancellationError(
          t("errors.chooseCancellationReason")
        );

        return;
      }

      if (
        itemCancelQuantity <
          1 ||
        itemCancelQuantity >
          itemToCancel.quantity
      ) {
        setItemCancellationError(
          t("errors.invalidQuantity")
        );

        return;
      }

      setCancellingItem(
        true
      );

      try {
        const response =
          await fetch(
            `/api/orders/${orderId}/items`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
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
          setItemCancellationError(
            data.error ||
              t("errors.cancelItem")
          );

          return;
        }

        await refreshOrder();

        closeItemCancellation();

        if (data.warning) {
          notify(
            "warning",
            data.warning
          );
        } else {
          notify(
            "success",
            t("feedback.itemCancelled")
          );
        }
      } catch {
        setItemCancellationError(
          t("errors.cancelItem")
        );
      } finally {
        setCancellingItem(
          false
        );
      }
    };

  const sendToKitchen =
    async () => {
      if (
        sendingKitchen
      ) {
        return;
      }

      setSendingKitchen(
        true
      );

      try {
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
          notify(
            "error",
            data.error ||
              t("errors.sendKitchen")
          );

          return;
        }

        await refreshOrder();

        if (
          data.type ===
          "addition"
        ) {
          notify(
            "success",
            t("feedback.additionsSent")
          );
        } else {
          notify(
            "success",
            t("feedback.orderSent")
          );
        }
      } catch {
        notify(
          "error",
          t("errors.sendKitchen")
        );
      } finally {
        setSendingKitchen(
          false
        );
      }
    };

  const openPaymentModal =
    () => {
      setPaymentError("");
      setShowMobileCart(
        false
      );
      setShowPayment(true);
    };

  const payOrder = async (
    paymentMethod: string
  ) => {
    if (payingMethod) {
      return;
    }

    setPaymentError("");
    setPayingMethod(
      paymentMethod
    );

    try {
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
        setPaymentError(
          data.error ||
            t("errors.paymentFailed")
        );

        return;
      }

      if (data.warning) {
        notify(
          "warning",
          data.warning
        );

        window.setTimeout(
          () => {
            router.push(
              "/cashier"
            );
          },
          1000
        );

        return;
      }

      router.push(
        "/cashier"
      );
    } catch {
      setPaymentError(
        t("errors.paymentFailed")
      );
    } finally {
      setPayingMethod(
        null
      );
    }
  };

  const openCancellationModal =
    () => {
      setShowMobileCart(
        false
      );

      setCancellationReason(
        ""
      );

      setCustomCancellationReason(
        ""
      );

      setCancellationError(
        ""
      );

      setShowCancellation(
        true
      );
    };

  const cancelOrder =
    async () => {
      if (cancelling) {
        return;
      }

      setCancellationError(
        ""
      );

      const finalReason =
        cancellationReason ===
        "Autre"
          ? customCancellationReason.trim()
          : cancellationReason;

      if (!finalReason) {
        setCancellationError(
          t("errors.chooseCancellationReason")
        );

        return;
      }

      setCancelling(true);

      try {
        const response =
          await fetch(
            `/api/orders/${orderId}/cancel`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  reason:
                    finalReason,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setCancellationError(
            data.error ||
              t("errors.cancelOrder")
          );

          return;
        }

        if (data.warning) {
          notify(
            "warning",
            data.warning
          );

          window.setTimeout(
            () => {
              router.push(
                "/cashier"
              );
            },
            1000
          );

          return;
        }

        router.push(
          "/cashier"
        );
      } catch {
        setCancellationError(
          t("errors.cancelOrder")
        );
      } finally {
        setCancelling(
          false
        );
      }
    };

  const filteredMenu =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLocaleLowerCase(
            "fr"
          );

      if (query) {
        return menu.filter(
          (item) =>
            item.name
              .toLocaleLowerCase(
                "fr"
              )
              .includes(
                query
              )
        );
      }

      return menu.filter(
        (item) =>
          item.category ===
          category
      );
    }, [
      menu,
      category,
      search,
    ]);

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

  const totalUnits =
    useMemo(() => {
      return orderItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity ||
              0
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
    orderItems.length >
      0 &&
    pendingKitchenQuantity ===
      0;

  const renderOrderPanel =
    () => (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              {t("order.title")}
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              {totalUnits ===
              0
                ? t("order.noItems")
                : t("order.items", { count: totalUnits })}
            </p>
          </div>

          {pendingKitchenQuantity >
            0 && (
            <span className="rounded-full bg-[#FFF6E9] px-3 py-1.5 text-xs font-semibold text-[#9A5A18]">
              {
                pendingKitchenQuantity
              }{" "}
              {t("order.toSend")}
            </span>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {orderItems.length ===
            0 && (
            <div className="rounded-2xl bg-[#F7F7F3] px-4 py-8 text-center">
              <p className="font-semibold text-[#4E5651]">
                {t("order.empty")}
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                {t("order.touchProduct")}
              </p>
            </div>
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

              const cancelledQuantity =
                Number(
                  item.cancelled_quantity ||
                    0
                );

              const isUpdating =
                updatingItemId ===
                item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E9E6DF] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-5 text-[#1F2924]">
                        {product?.name ||
                          t("order.item")}
                      </p>

                      <p className="mt-1 text-xs text-[#8A918C]">
                        {formatMoney(
                          Number(
                            item.unit_price
                          )
                        )}{" "}
                        MRU / {t("order.unit")}
                      </p>
                    </div>

                    <p className="shrink-0 font-bold text-[#1F2924]">
                      {formatMoney(
                        quantity *
                          Number(
                            item.unit_price
                          )
                      )}{" "}
                      MRU
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sentQuantity >
                      0 && (
                      <span className="rounded-full bg-[#EDF5EF] px-2.5 py-1 text-[11px] font-semibold text-[#2E6A50]">
                        {
                          sentQuantity
                        }{" "}
                        {t("order.kitchen")}
                      </span>
                    )}

                    {pendingQuantity >
                      0 && (
                      <span className="rounded-full bg-[#FFF6E9] px-2.5 py-1 text-[11px] font-semibold text-[#9A5A18]">
                        {
                          pendingQuantity
                        }{" "}
                        {t("order.toSend")}
                      </span>
                    )}

                    {cancelledQuantity >
                      0 && (
                      <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]">
                        {
                          cancelledQuantity
                        }{" "}
                        {t("order.cancelled")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-xl border border-[#E3E1DA] bg-[#FAFAF7]">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(
                            item.id,
                            "decrease"
                          )
                        }
                        disabled={
                          isUpdating ||
                          sendingKitchen
                        }
                        className="flex h-10 w-10 items-center justify-center text-xl font-medium text-[#5F6762] disabled:opacity-35"
                      >
                        −
                      </button>

                      <span className="flex min-w-9 items-center justify-center text-sm font-bold text-[#1F2924]">
                        {isUpdating ? (
                          <Spinner
                            dark
                          />
                        ) : (
                          quantity
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateItem(
                            item.id,
                            "increase"
                          )
                        }
                        disabled={
                          isUpdating ||
                          sendingKitchen
                        }
                        className="flex h-10 w-10 items-center justify-center text-xl font-medium text-[#1E4D3A] disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>

                    {sentQuantity >
                    0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          openItemCancellation(
                            item,
                            1
                          )
                        }
                        disabled={
                          isUpdating ||
                          sendingKitchen
                        }
                        className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#B24D3E] transition hover:bg-[#FFF1EE] disabled:opacity-40"
                      >
                        {t("actions.cancel")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(
                            item.id,
                            "delete"
                          )
                        }
                        disabled={
                          isUpdating ||
                          sendingKitchen
                        }
                        className="min-h-10 rounded-xl px-3 text-sm font-medium text-[#A16A61] transition hover:bg-[#FFF1EE] disabled:opacity-40"
                      >
                        {t("actions.delete")}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>

        <div className="mt-5 border-t border-[#E8E5DE] pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="font-semibold text-[#68706B]">
              {t("order.total")}
            </span>

            <p className="text-2xl font-black tracking-tight text-[#1F2924]">
              {formatMoney(
                total
              )}{" "}
              <span className="text-sm font-semibold text-[#737A75]">
                MRU
              </span>
            </p>
          </div>

          {pendingKitchenQuantity >
          0 ? (
            <>
              <button
                type="button"
                onClick={
                  sendToKitchen
                }
                disabled={
                  sendingKitchen
                }
                className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#B9782B] px-4 font-semibold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                {sendingKitchen ? (
                  <>
                    <Spinner />
                    {t("kitchen.sending")}
                  </>
                ) : hasBeenSentToKitchen ? (
                  t("kitchen.sendAdditions", { count: pendingKitchenQuantity })
                ) : (
                  t("kitchen.send")
                )}
              </button>

              <p className="mt-2 text-center text-xs leading-5 text-[#9A6A36]">
                {t("kitchen.sendBeforePayment")}
              </p>
            </>
          ) : (
            allItemsSent && (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#C7DACD] bg-[#EDF5EF] px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#3D7D5E]" />

                <p className="text-sm font-semibold text-[#1E4D3A]">
                  {t("kitchen.allSent")}
                </p>
              </div>
            )
          )}

          <button
            type="button"
            onClick={
              openPaymentModal
            }
            disabled={
              orderItems.length ===
                0 ||
              pendingKitchenQuantity >
                0 ||
              sendingKitchen
            }
            className="mt-3 flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-[#1E4D3A] px-4 font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D8DCD8] disabled:text-[#8D938F]"
          >
            {t("payment.collect")}
            {total > 0
              ? ` · ${formatMoney(
                  total
                )} MRU`
              : ""}
          </button>

          <button
            type="button"
            onClick={
              openCancellationModal
            }
            disabled={
              cancelling ||
              payingMethod !==
                null
            }
            className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-[#B24D3E] transition hover:bg-[#FFF1EE] disabled:opacity-40"
          >
            {t("cancellation.cancelOrder")}
          </button>
        </div>
      </>
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F2EB] p-4">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
            M
          </div>

          <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-[3px] border-[#D4DDD7] border-t-[#1E4D3A]" />

          <p className="mt-4 font-semibold text-[#343D38]">
            {t("loading")}
          </p>
        </div>
      </main>
    );
  }

  if (initialError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F2EB] p-4">
        <div className="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1EE] font-bold text-[#B24D3E]">
            !
          </div>

          <h1 className="mt-4 text-xl font-bold text-[#1F2924]">
            {t("unavailable.title")}
          </h1>

          <p className="mt-2 text-sm text-[#737A75]">
            {initialError}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-5 min-h-12 w-full rounded-2xl bg-[#1E4D3A] font-semibold text-white"
          >
            {t("actions.retry")}
          </button>

          <Link
            href="/cashier"
            className="mt-3 inline-flex py-2 text-sm font-semibold text-[#68706B]"
          >
            {t("actions.backToTables")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-4 pb-32 pt-4 md:p-6 lg:pb-6">
      {/* FEEDBACK */}
      {feedback && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div
            aria-live="polite"
            className={`rounded-2xl border px-4 py-3 shadow-xl ${
              feedback.type ===
              "success"
                ? "border-[#C7DACD] bg-[#EDF5EF] text-[#1E4D3A]"
                : feedback.type ===
                  "warning"
                ? "border-[#EED3A8] bg-[#FFF6E9] text-[#8D5519]"
                : "border-[#EDC7C0] bg-[#FFF1EE] text-[#A74435]"
            }`}
          >
            <p className="text-sm font-semibold">
              {
                feedback.message
              }
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/cashier"
              className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-[#567362] transition hover:bg-white"
            >
              {t("actions.backToTablesArrow")}
            </Link>

            {orderNumber && (
              <span className="rounded-full border border-[#E2DFD7] bg-white px-3 py-1.5 text-xs font-semibold text-[#727A75]">
                {t("order.number", { number: orderNumber })}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2E6A50]">
                MAIDA · {t("cashier")}
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924]">
                {orderLabel}
              </h1>
            </div>

            <div className="hidden text-end sm:block">
              <p className="text-xs font-medium text-[#8A918C]">
                {t("order.total")}
              </p>

              <p className="mt-1 text-2xl font-black text-[#1F2924]">
                {formatMoney(
                  total
                )}{" "}
                <span className="text-sm font-semibold text-[#737A75]">
                  MRU
                </span>
              </p>
            </div>
          </div>
        </header>

        {/* RECHERCHE */}
        <div className="mb-4">
          <label
            htmlFor="product-search"
            className="sr-only"
          >
            {t("search.label")}
          </label>

          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder={t("search.placeholder")}
            className="h-12 w-full rounded-2xl border border-[#E2DFD7] bg-white px-4 text-[#1F2924] outline-none transition placeholder:text-[#A0A6A2] focus:border-[#8EB19A] focus:ring-4 focus:ring-[#DDE8DF]"
          />
        </div>

        {/* CATÉGORIES */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {categories.map(
            (item) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  setCategory(
                    item
                  );

                  setSearch("");
                }}
                className={
                  category ===
                    item &&
                  !search
                    ? "min-h-10 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 text-sm font-semibold text-white"
                    : "min-h-10 whitespace-nowrap rounded-xl border border-[#E5E2DA] bg-white px-4 text-sm font-semibold text-[#68706B] transition hover:border-[#C9D7CC]"
                }
              >
                {getCategoryLabel(item)}
              </button>
            )
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          {/* MENU */}
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F2924]">
                  {search
                    ? t("search.results")
                    : getCategoryLabel(category)}
                </h2>

                <p className="mt-0.5 text-xs text-[#8A918C]">
                  {
                    filteredMenu.length
                  }{" "}
                  {t("search.products", { count: filteredMenu.length })}
                </p>
              </div>

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="text-sm font-semibold text-[#2E6A50]"
                >
                  {t("actions.clear")}
                </button>
              )}
            </div>

            {filteredMenu.length ===
            0 ? (
              <div className="rounded-[24px] border border-[#E5E2DA] bg-white px-5 py-12 text-center">
                <p className="font-semibold text-[#4E5651]">
                  {t("search.noProduct")}
                </p>

                <p className="mt-1 text-sm text-[#8A918C]">
                  {t("search.tryAnother")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
                {filteredMenu.map(
                  (item) => {
                    const isAdding =
                      addingId ===
                      item.id;

                    return (
                      <button
                        type="button"
                        key={
                          item.id
                        }
                        onClick={() =>
                          addItem(
                            item.id
                          )
                        }
                        disabled={
                          Boolean(
                            addingId
                          )
                        }
                        className="group relative min-h-[128px] rounded-[20px] border border-[#E8E5DE] bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9D7CC] hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
                      >
                        <div className="flex h-full flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold leading-5 text-[#1F2924]">
                              {
                                item.name
                              }
                            </p>

                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDF5EF] text-lg font-medium text-[#1E4D3A] transition group-hover:bg-[#1E4D3A] group-hover:text-white">
                              {isAdding ? (
                                <Spinner
                                  dark
                                />
                              ) : (
                                "+"
                              )}
                            </span>
                          </div>

                          <p className="mt-4 font-bold text-[#2E6A50]">
                            {formatMoney(
                              Number(
                                item.price
                              )
                            )}{" "}
                            <span className="text-xs font-semibold text-[#77827B]">
                              MRU
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* COMMANDE DESKTOP */}
          <aside className="hidden h-fit max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[26px] border border-[#E4E1D9] bg-[#FCFCF9] p-5 shadow-sm lg:sticky lg:top-6 lg:block">
            {renderOrderPanel()}
          </aside>
        </div>
      </div>

      {/* BARRE MOBILE */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DDDAD2] bg-white/95 px-3 pt-3 shadow-[0_-10px_30px_-20px_rgba(31,41,36,0.4)] backdrop-blur lg:hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setShowMobileCart(
                true
              )
            }
            className="min-h-[52px] min-w-0 flex-1 rounded-2xl border border-[#E0DED7] bg-[#F8F8F5] px-4 text-start"
          >
            <p className="truncate text-xs font-medium text-[#7A817C]">
              {t("order.mobileSummary", { count: totalUnits })}
            </p>

            <p className="mt-0.5 font-black text-[#1F2924]">
              {formatMoney(
                total
              )}{" "}
              MRU
            </p>
          </button>

          {pendingKitchenQuantity >
          0 ? (
            <button
              type="button"
              onClick={
                sendToKitchen
              }
              disabled={
                sendingKitchen
              }
              className="flex min-h-[52px] min-w-[132px] items-center justify-center gap-2 rounded-2xl bg-[#B9782B] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {sendingKitchen ? (
                <Spinner />
              ) : (
                <>
                  {t("kitchen.sendShort")}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {
                      pendingKitchenQuantity
                    }
                  </span>
                </>
              )}
            </button>
          ) : allItemsSent ? (
            <button
              type="button"
              onClick={
                openPaymentModal
              }
              className="min-h-[52px] min-w-[120px] rounded-2xl bg-[#1E4D3A] px-4 text-sm font-bold text-white"
            >
              {t("payment.collect")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setShowMobileCart(
                  true
                )
              }
              className="min-h-[52px] rounded-2xl bg-[#1E4D3A] px-4 text-sm font-bold text-white"
            >
              {t("actions.view")}
            </button>
          )}
        </div>
      </div>

      {/* COMMANDE MOBILE */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#17201B]/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4 lg:hidden">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[30px] bg-[#FCFCF9] p-5 shadow-2xl sm:max-w-lg sm:rounded-[30px] pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#D9D7D0] sm:hidden" />

              <button
                type="button"
                onClick={() =>
                  setShowMobileCart(
                    false
                  )
                }
                className="ms-auto hidden min-h-10 rounded-xl px-3 text-sm font-semibold text-[#68706B] sm:block"
              >
                {t("actions.close")}
              </button>
            </div>

            {renderOrderPanel()}

            <button
              type="button"
              onClick={() =>
                setShowMobileCart(
                  false
                )
              }
              className="mt-3 min-h-11 w-full text-sm font-semibold text-[#7A817C] sm:hidden"
            >
              {t("actions.continueAdding")}
            </button>
          </div>
        </div>
      )}

      {/* PAIEMENT */}
      {showPayment && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#17201B]/55 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#DDDAD3] sm:hidden" />

            <p className="text-sm font-semibold text-[#2E6A50]">
              {t("payment.title")}
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              {t("payment.choose")}
            </h2>

            <div className="mt-5 rounded-2xl bg-[#EDF5EF] p-4">
              <p className="text-sm text-[#667D6D]">
                {t("payment.totalToCollect")}
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-[#1E4D3A]">
                {formatMoney(
                  total
                )}{" "}
                <span className="text-base font-semibold">
                  MRU
                </span>
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              {paymentMethods.map(
                (method) => {
                  const isPaying =
                    payingMethod ===
                    method;

                  return (
                    <button
                      type="button"
                      key={
                        method
                      }
                      disabled={
                        payingMethod !==
                        null
                      }
                      onClick={() =>
                        payOrder(
                          method
                        )
                      }
                      className="flex min-h-[54px] items-center justify-between rounded-2xl border border-[#E4E1D9] bg-white px-4 font-semibold text-[#343D38] transition hover:border-[#AFC7B6] hover:bg-[#F7FAF7] active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
                    >
                      <span>
                        {getPaymentLabel(method)}
                      </span>

                      {isPaying ? (
                        <Spinner
                          dark
                        />
                      ) : (
                        <span className="text-[#9BA19D]">
                          →
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>

            {paymentError && (
              <div className="mt-4 rounded-2xl border border-[#EDC7C0] bg-[#FFF1EE] px-4 py-3 text-sm font-medium text-[#A74435]">
                {paymentError}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowPayment(
                  false
                );

                setPaymentError(
                  ""
                );
              }}
              disabled={
                payingMethod !==
                null
              }
              className="mt-4 min-h-11 w-full text-sm font-semibold text-[#7A817C] disabled:opacity-40"
            >
              {t("actions.back")}
            </button>
          </div>
        </div>
      )}

      {/* ANNULATION COMMANDE */}
      {showCancellation && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17201B]/55 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#DDDAD3] sm:hidden" />

            <p className="text-sm font-semibold text-[#B24D3E]">
              {t("cancellation.finalAction")}
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              {t("cancellation.cancelOrder")}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#737A75]">
              {t("cancellation.orderHistoryInfo")}
            </p>

            {hasBeenSentToKitchen && (
              <div className="mt-4 rounded-2xl border border-[#EED3A8] bg-[#FFF6E9] p-4">
                <p className="text-sm font-semibold text-[#8D5519]">
                  {t("cancellation.alreadySent")}
                </p>

                <p className="mt-1 text-xs leading-5 text-[#956D44]">
                  {t("cancellation.kitchenCancellationGenerated")}
                </p>
              </div>
            )}

            <p className="mb-2 mt-5 text-sm font-semibold text-[#343D38]">
              {t("cancellation.reason")}
            </p>

            <div className="space-y-2">
              {cancellationReasons.map(
                (reason) => (
                  <button
                    type="button"
                    key={
                      reason
                    }
                    onClick={() => {
                      setCancellationReason(
                        reason
                      );

                      setCancellationError(
                        ""
                      );
                    }}
                    disabled={
                      cancelling
                    }
                    className={
                      cancellationReason ===
                      reason
                        ? "min-h-[50px] w-full rounded-2xl border border-[#C45D4D] bg-[#FFF1EE] px-4 text-start font-semibold text-[#A74435]"
                        : "min-h-[50px] w-full rounded-2xl border border-[#E4E1D9] px-4 text-start font-medium text-[#4E5651] transition hover:bg-[#FAFAF7]"
                    }
                  >
                    {getCancellationReasonLabel(reason)}
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
                ) => {
                  setCustomCancellationReason(
                    event.target
                      .value
                  );

                  setCancellationError(
                    ""
                  );
                }}
                disabled={
                  cancelling
                }
                placeholder={t("cancellation.reasonPlaceholder")}
                className="mt-3 min-h-24 w-full rounded-2xl border border-[#E4E1D9] bg-[#FAFAF7] p-3 text-[#1F2924] outline-none focus:border-[#C45D4D] focus:bg-white focus:ring-4 focus:ring-[#F5DEDA] disabled:opacity-50"
              />
            )}

            {cancellationError && (
              <div className="mt-4 rounded-2xl border border-[#EDC7C0] bg-[#FFF1EE] px-4 py-3 text-sm font-medium text-[#A74435]">
                {
                  cancellationError
                }
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
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

                  setCancellationError(
                    ""
                  );
                }}
                disabled={
                  cancelling
                }
                className="min-h-[52px] flex-1 rounded-2xl border border-[#E3E0D8] font-semibold text-[#68706B] disabled:opacity-40"
              >
                {t("actions.back")}
              </button>

              <button
                type="button"
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
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B84B3C] px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cancelling ? (
                  <>
                    <Spinner />
                    {t("cancellation.cancelling")}
                  </>
                ) : (
                  t("actions.confirm")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANNULATION ARTICLE */}
      {itemToCancel && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#17201B]/55 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#DDDAD3] sm:hidden" />

            <p className="text-sm font-semibold text-[#B24D3E]">
              {t("itemCancellation.title")}
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              {getProduct(
                itemToCancel
              )?.name ||
                t("order.item")}
            </h2>

            <div className="mt-5 rounded-2xl bg-[#F7F7F3] p-4">
              <p className="text-sm font-semibold text-[#4E5651]">
                {t("itemCancellation.quantity")}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
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
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDDAD3] bg-white text-xl font-medium disabled:opacity-35"
                >
                  −
                </button>

                <span className="min-w-10 text-center text-2xl font-black text-[#1F2924]">
                  {
                    itemCancelQuantity
                  }
                </span>

                <button
                  type="button"
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
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDDAD3] bg-white text-xl font-medium text-[#1E4D3A] disabled:opacity-35"
                >
                  +
                </button>

                <span className="text-sm text-[#7A817C]">
                  {t("itemCancellation.outOf", { count: itemToCancel.quantity })}
                </span>
              </div>
            </div>

            {Number(
              itemToCancel.sent_quantity ||
                0
            ) > 0 && (
              <div className="mt-4 rounded-2xl border border-[#EED3A8] bg-[#FFF6E9] p-4">
                <p className="text-sm font-semibold text-[#8D5519]">
                  {t("itemCancellation.alreadySent")}
                </p>

                <p className="mt-1 text-xs leading-5 text-[#956D44]">
                  {t("itemCancellation.kitchenInfo")}
                </p>
              </div>
            )}

            <p className="mb-2 mt-5 text-sm font-semibold text-[#343D38]">
              {t("cancellation.reason")}
            </p>

            <div className="space-y-2">
              {cancellationReasons.map(
                (reason) => (
                  <button
                    type="button"
                    key={
                      reason
                    }
                    onClick={() => {
                      setItemCancellationReason(
                        reason
                      );

                      setItemCancellationError(
                        ""
                      );
                    }}
                    disabled={
                      cancellingItem
                    }
                    className={
                      itemCancellationReason ===
                      reason
                        ? "min-h-[50px] w-full rounded-2xl border border-[#C45D4D] bg-[#FFF1EE] px-4 text-start font-semibold text-[#A74435]"
                        : "min-h-[50px] w-full rounded-2xl border border-[#E4E1D9] px-4 text-start font-medium text-[#4E5651] transition hover:bg-[#FAFAF7]"
                    }
                  >
                    {getCancellationReasonLabel(reason)}
                  </button>
                )
              )}
            </div>

            {itemCancellationReason ===
              "Autre" && (
              <textarea
                value={
                  customItemCancellationReason
                }
                onChange={(
                  event
                ) => {
                  setCustomItemCancellationReason(
                    event.target
                      .value
                  );

                  setItemCancellationError(
                    ""
                  );
                }}
                disabled={
                  cancellingItem
                }
                placeholder={t("cancellation.reasonPlaceholder")}
                className="mt-3 min-h-24 w-full rounded-2xl border border-[#E4E1D9] bg-[#FAFAF7] p-3 text-[#1F2924] outline-none focus:border-[#C45D4D] focus:bg-white focus:ring-4 focus:ring-[#F5DEDA] disabled:opacity-50"
              />
            )}

            {itemCancellationError && (
              <div className="mt-4 rounded-2xl border border-[#EDC7C0] bg-[#FFF1EE] px-4 py-3 text-sm font-medium text-[#A74435]">
                {
                  itemCancellationError
                }
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={
                  closeItemCancellation
                }
                disabled={
                  cancellingItem
                }
                className="min-h-[52px] flex-1 rounded-2xl border border-[#E3E0D8] font-semibold text-[#68706B] disabled:opacity-40"
              >
                {t("actions.back")}
              </button>

              <button
                type="button"
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
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B84B3C] px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cancellingItem ? (
                  <>
                    <Spinner />
                    {t("cancellation.cancelling")}
                  </>
                ) : (
                  t("actions.confirm")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}