"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function OrderClient({
  orderId,
  tableName,
}: {
  orderId: string;
  tableName: string;
}) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [category, setCategory] = useState("Snacks");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paying, setPaying] = useState(false);

  const payOrder = async (paymentMethod: string) => {
  setPaying(true);

  const response = await fetch(
        `/api/orders/${orderId}/pay`,
        {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            paymentMethod,
        }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        alert(data.error || "Paiement impossible.");
        setPaying(false);
        return;
    }

    window.location.href = "/cashier";
    };

  const loadMenu = async () => {
    const response = await fetch("/api/menu");
    const data = await response.json();

    if (response.ok) {
      setMenu(data);
    }
  };

  const loadOrder = async () => {
    const response = await fetch(
      `/api/orders/${orderId}/items`
    );

    const data = await response.json();

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

  const addItem = async (menuItemId: string) => {
    setAddingId(menuItemId);

    const response = await fetch(
      `/api/orders/${orderId}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          menuItemId,
        }),
      }
    );

    if (response.ok) {
      await loadOrder();
    }

    setAddingId(null);
  };
  const updateItem = async (
    itemId: string,
    action: "increase" | "decrease" | "delete"
    ) => {
    const response = await fetch(
        `/api/orders/${orderId}/items`,
        {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            itemId,
            action,
        }),
        }
    );

    if (response.ok) {
        await loadOrder();
    }
    };

  const filteredMenu = menu.filter(
    (item) => item.category === category
  );

  const total = useMemo(() => {
    return orderItems.reduce(
      (sum, item) =>
        sum +
        Number(item.unit_price) *
          Number(item.quantity),
      0
    );
  }, [orderItems]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Chargement de la commande...
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
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={
                category === item
                  ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-white"
                  : "whitespace-nowrap rounded-xl bg-white px-4 py-2 text-slate-700 shadow-sm"
              }
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addItem(item.id)}
                  disabled={addingId === item.id}
                  className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-50"
                >
                  <p className="font-semibold">
                    {item.name}
                  </p>

                  <p className="mt-2 font-bold text-sky-600">
                    {item.price} MRU
                  </p>
                </button>
              ))}
            </div>
          </section>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-bold">
              Commande en cours
            </h2>

            <div className="mt-5 space-y-3">
              {orderItems.length === 0 && (
                <p className="text-sm text-slate-500">
                  Aucun produit ajouté.
                </p>
              )}

              {orderItems.map((item) => {
                const product = Array.isArray(
                  item.menu_items
                )
                  ? item.menu_items[0]
                  : item.menu_items;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b pb-3"
                  >
                    <div>
                        <p className="font-medium">
                            {product?.name}
                        </p>

                        <p className="text-sm text-slate-500">
                            {item.unit_price} MRU / unité
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                            <button
                            onClick={() =>
                                updateItem(item.id, "decrease")
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border"
                            >
                            −
                            </button>

                            <span className="min-w-6 text-center font-medium">
                            {item.quantity}
                            </span>

                            <button
                            onClick={() =>
                                updateItem(item.id, "increase")
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border"
                            >
                            +
                            </button>

                            <button
                            onClick={() =>
                                updateItem(item.id, "delete")
                            }
                            className="ml-2 text-sm text-red-500"
                            >
                            Supprimer
                            </button>
                        </div>
                        </div>

                    <p className="font-semibold">
                      {Number(item.quantity) *
                        Number(item.unit_price)}{" "}
                      MRU
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">
                Total
              </span>

              <span className="text-2xl font-bold">
                {total} MRU
              </span>
            </div>

            <button
                onClick={() => setShowPayment(true)}
                disabled={orderItems.length === 0}
                className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white disabled:opacity-40"
                >
                Payer
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
                    ].map((method) => (
                    <button
                        key={method}
                        disabled={paying}
                        onClick={() => payOrder(method)}
                        className="w-full rounded-xl border px-4 py-3 text-left font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                        {method}
                    </button>
                    ))}
                </div>

                <button
                    onClick={() => setShowPayment(false)}
                    disabled={paying}
                    className="mt-4 w-full py-2 text-sm text-slate-500"
                >
                    Annuler
                </button>
                </div>
            </div>
            )}
      </div>
    </main>
  );
}