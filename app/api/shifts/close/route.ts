import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

type ProductStat = {
  menuItemId: string;
  name: string;
  category: string;
  soldQuantity: number;
  cancelledQuantity: number;
};

export async function POST() {
  const session = await getSession();

  if (
    !session ||
    session.role !== "cashier"
  ) {
    return NextResponse.json(
      {
        error: "Accès non autorisé.",
      },
      { status: 403 }
    );
  }

  /*
   * SHIFT ACTUEL
   */
  const {
    data: shift,
    error: shiftError,
  } = await supabaseAdmin
    .from("shifts")
    .select(`
      id,
      cashier_id,
      started_at,
      status
    `)
    .eq(
      "cashier_id",
      session.id
    )
    .eq(
      "status",
      "open"
    )
    .order(
      "started_at",
      {
        ascending: false,
      }
    )
    .maybeSingle();

  if (
    shiftError ||
    !shift
  ) {
    return NextResponse.json(
      {
        error:
          "Aucun shift ouvert.",
      },
      { status: 400 }
    );
  }

  /*
   * 1. BLOQUER S'IL RESTE
   * DES COMMANDES OUVERTES
   */
  const {
    data: openOrders,
    error: openOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number
    `)
    .eq(
      "cashier_id",
      session.id
    )
    .eq(
      "status",
      "open"
    );

  if (openOrdersError) {
    return NextResponse.json(
      {
        error:
          "Impossible de vérifier les commandes ouvertes.",
      },
      { status: 500 }
    );
  }

  const openOrderCount =
    (openOrders || []).length;

  if (openOrderCount > 0) {
    return NextResponse.json(
      {
        error:
          `${openOrderCount} commande${
            openOrderCount > 1
              ? "s sont encore ouvertes"
              : " est encore ouverte"
          }. Encaissez ou annulez ${
            openOrderCount > 1
              ? "ces commandes"
              : "cette commande"
          } avant de fermer le shift.`,

        openOrderCount,

        openOrders:
          (openOrders || []).map(
            (order) => ({
              id: order.id,
              orderNumber:
                order.order_number,
            })
          ),
      },
      { status: 400 }
    );
  }

  const endedAt =
    new Date().toISOString();

  /*
   * NOM DU CAISSIER
   */
  const {
    data: cashier,
  } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq(
      "id",
      session.id
    )
    .maybeSingle();

  const cashierName =
    cashier?.name ||
    "Caissier";

  /*
   * 2. COMMANDES PAYÉES DU SHIFT
   */
  const {
    data: paidOrders,
    error: paidOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      total,
      payment_method,
      paid_at,
      order_items (
        id,
        menu_item_id,
        quantity,
        unit_price,
        menu_items (
          id,
          name,
          category
        )
      )
    `)
    .eq(
      "status",
      "paid"
    )
    .eq(
      "shift_id",
      shift.id
    );

  if (paidOrdersError) {
    return NextResponse.json(
      {
        error:
          "Impossible de calculer les ventes du shift.",
      },
      { status: 500 }
    );
  }

  /*
   * 3. COMMANDES COMPLÈTEMENT
   * ANNULÉES PENDANT LE SHIFT
   */
  const {
    data: cancelledOrders,
    error: cancelledOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      cancelled_at,
      cancellation_reason,
      order_items (
        id,
        menu_item_id,
        quantity,
        unit_price,
        menu_items (
          id,
          name,
          category
        )
      )
    `)
    .eq(
      "status",
      "cancelled"
    )
    .eq(
      "cancelled_by",
      session.id
    )
    .gte(
      "cancelled_at",
      shift.started_at
    )
    .lte(
      "cancelled_at",
      endedAt
    );

  if (cancelledOrdersError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les commandes annulées.",
      },
      { status: 500 }
    );
  }

  /*
   * 4. ANNULATIONS PARTIELLES
   * D'ARTICLES PENDANT LE SHIFT
   */
  const {
    data: itemCancellations,
    error: itemCancellationsError,
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
      created_at
    `)
    .eq(
      "cashier_id",
      session.id
    )
    .gte(
      "created_at",
      shift.started_at
    )
    .lte(
      "created_at",
      endedAt
    );

  if (itemCancellationsError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les articles annulés.",
      },
      { status: 500 }
    );
  }

  /*
   * On récupère les produits correspondant
   * aux annulations partielles.
   */
  const cancelledItemIds = [
    ...new Set(
      (itemCancellations || [])
        .map(
          (item) =>
            item.order_item_id
        )
        .filter(Boolean)
    ),
  ];

  let cancelledOrderItems:
    any[] = [];

  if (
    cancelledItemIds.length > 0
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        menu_item_id,
        unit_price,
        menu_items (
          id,
          name,
          category
        )
      `)
      .in(
        "id",
        cancelledItemIds
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            "Impossible de récupérer les produits annulés.",
        },
        { status: 500 }
      );
    }

    cancelledOrderItems =
      data || [];
  }

  /*
   * 5. RAPPORT CAISSE
   */
  const paidOrderCount =
    (paidOrders || []).length;

  const cancelledOrderCount =
    (cancelledOrders || [])
      .length;

  const revenue =
    (paidOrders || []).reduce(
      (sum, order) =>
        sum +
        Number(
          order.total || 0
        ),
      0
    );

  const paymentTotals: Record<
    string,
    number
  > = {
    Cash: 0,
    Bankily: 0,
    Masrivi: 0,
    Sedad: 0,
    "BCI PAY": 0,
  };

  for (
    const order of
    paidOrders || []
  ) {
    const method =
      order.payment_method;

    if (
      method &&
      paymentMethods.includes(
        method
      )
    ) {
      paymentTotals[
        method
      ] +=
        Number(
          order.total || 0
        );
    }
  }

  /*
   * 6. RAPPORT PRODUITS
   */
  const products =
    new Map<
      string,
      ProductStat
    >();

  const addProduct = (
    menuItemId: string,
    name: string,
    category: string,
    type:
      | "sold"
      | "cancelled",
    quantity: number
  ) => {
    if (
      quantity <= 0
    ) {
      return;
    }

    const key =
      menuItemId ||
      `${category}-${name}`;

    const existing =
      products.get(key) || {
        menuItemId,
        name,
        category,
        soldQuantity: 0,
        cancelledQuantity: 0,
      };

    if (
      type === "sold"
    ) {
      existing.soldQuantity +=
        quantity;
    } else {
      existing.cancelledQuantity +=
        quantity;
    }

    products.set(
      key,
      existing
    );
  };

  /*
   * PRODUITS VENDUS
   *
   * Quantités restantes sur les
   * commandes réellement payées.
   */
  for (
    const order of
    paidOrders || []
  ) {
    for (
      const item of
      order.order_items || []
    ) {
      const product =
        Array.isArray(
          item.menu_items
        )
          ? item.menu_items[0]
          : item.menu_items;

      addProduct(
        item.menu_item_id ||
          product?.id ||
          "",
        product?.name ||
          "Produit",
        product?.category ||
          "",
        "sold",
        Number(
          item.quantity || 0
        )
      );
    }
  }

  /*
   * PRODUITS D'UNE COMMANDE
   * ENTIÈREMENT ANNULÉE
   */
  for (
    const order of
    cancelledOrders || []
  ) {
    for (
      const item of
      order.order_items || []
    ) {
      const product =
        Array.isArray(
          item.menu_items
        )
          ? item.menu_items[0]
          : item.menu_items;

      addProduct(
        item.menu_item_id ||
          product?.id ||
          "",
        product?.name ||
          "Produit",
        product?.category ||
          "",
        "cancelled",
        Number(
          item.quantity || 0
        )
      );
    }
  }

  /*
   * PRODUITS ANNULÉS
   * PARTIELLEMENT
   */
  const cancelledItemMap =
    new Map<
      string,
      any
    >();

  for (
    const item of
    cancelledOrderItems
  ) {
    cancelledItemMap.set(
      item.id,
      item
    );
  }

  for (
    const cancellation of
    itemCancellations || []
  ) {
    const item =
      cancelledItemMap.get(
        cancellation.order_item_id
      );

    if (!item) {
      continue;
    }

    const product =
      Array.isArray(
        item.menu_items
      )
        ? item.menu_items[0]
        : item.menu_items;

    addProduct(
      item.menu_item_id ||
        product?.id ||
        "",
      product?.name ||
        "Produit",
      product?.category ||
        "",
      "cancelled",
      Number(
        cancellation.quantity ||
          0
      )
    );
  }

  const productReport =
    Array.from(
      products.values()
    ).sort(
      (a, b) => {
        const categoryCompare =
          a.category.localeCompare(
            b.category,
            "fr"
          );

        if (
          categoryCompare !== 0
        ) {
          return categoryCompare;
        }

        return a.name.localeCompare(
          b.name,
          "fr"
        );
      }
    );

  const totalSoldItems =
    productReport.reduce(
      (sum, product) =>
        sum +
        product.soldQuantity,
      0
    );

  const totalCancelledItems =
    productReport.reduce(
      (sum, product) =>
        sum +
        product.cancelledQuantity,
      0
    );

  /*
   * DATE DU RAPPORT
   *
   * Le service d'impression utilisera
   * startedAt / endedAt pour afficher
   * précisément les heures.
   */
  const reportDate =
    new Date(
      shift.started_at
    )
      .toISOString()
      .slice(0, 10);

  /*
   * 7. FERMER LE SHIFT
   */
  const {
    data: closedShift,
    error: closeError,
  } = await supabaseAdmin
    .from("shifts")
    .update({
      status: "closed",
      ended_at:
        endedAt,
    })
    .eq(
      "id",
      shift.id
    )
    .eq(
      "status",
      "open"
    )
    .select("id")
    .maybeSingle();

  if (
    closeError ||
    !closedShift
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de fermer le shift.",
      },
      { status: 500 }
    );
  }

  /*
   * 8. RAPPORT 1 : CAISSE
   */
  const summaryPayload = {
    reportType:
      "shift_summary",

    shiftId:
      shift.id,

    date:
      reportDate,

    cashier: {
      id:
        session.id,

      name:
        cashierName,
    },

    startedAt:
      shift.started_at,

    endedAt,

    paidOrderCount,

    cancelledOrderCount,

    revenue,

    payments:
      paymentTotals,
  };

  /*
   * 9. RAPPORT 2 : PRODUITS
   */
  const productsPayload = {
    reportType:
      "shift_products",

    shiftId:
      shift.id,

    date:
      reportDate,

    cashier: {
      id:
        session.id,

      name:
        cashierName,
    },

    startedAt:
      shift.started_at,

    endedAt,

    totalSoldItems,

    totalCancelledItems,

    products:
      productReport,
  };

  /*
   * 10. CRÉER LES DEUX
   * JOBS D'IMPRESSION
   */
  const {
    error: printJobsError,
  } = await supabaseAdmin
    .from("print_jobs")
    .insert([
      {
        shift_id:
          shift.id,

        created_by:
          session.id,

        printer_role:
          "cashier",

        job_type:
          "shift_summary",

        status:
          "pending",

        payload:
          summaryPayload,
      },

      {
        shift_id:
          shift.id,

        created_by:
          session.id,

        printer_role:
          "cashier",

        job_type:
          "shift_products",

        status:
          "pending",

        payload:
          productsPayload,
      },
    ]);

  /*
   * Le shift reste bien fermé même si
   * la préparation des impressions échoue.
   */
  return NextResponse.json({
    success: true,

    shift: {
      id:
        shift.id,

      startedAt:
        shift.started_at,

      endedAt,
    },

    summary: {
      paidOrderCount,

      cancelledOrderCount,

      revenue,

      payments:
        paymentTotals,
    },

    products: {
      totalSoldItems,

      totalCancelledItems,

      items:
        productReport,
    },

    reportsCreated:
      !printJobsError,

    warning:
      printJobsError
        ? "Le shift est fermé, mais les rapports n'ont pas pu être ajoutés à la file d'impression."
        : null,
  });
}