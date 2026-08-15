import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Period =
  | "today"
  | "week"
  | "month"
  | "all";

type ProductStat = {
  id: string;
  name: string;
  category: string;
  sold: number;
  cancelled: number;
};

type CancellationHistoryItem = {
  key: string;
  orderId: string;
  orderNumber: number | null;
  location: string;
  date: string;
  type: "order" | "item";
  label: string;
  reason: string;
  cashier: string;
  quantity: number;
  beforeKitchen: number;
  afterKitchen: number;
};

type ShiftSummaryPayload = {
  date?: string;

  cashier?: {
    id?: string;
    name?: string;
  };

  startedAt?: string;
  endedAt?: string;

  revenue?: number;

  paidOrderCount?: number;
  cancelledOrderCount?: number;

  payments?: Record<
    string,
    number
  >;
};

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

function getBusinessDayRange() {
  const now = new Date();

  const start = new Date(now);

  if (
    now.getUTCHours() < 7
  ) {
    start.setUTCDate(
      start.getUTCDate() - 1
    );
  }

  start.setUTCHours(
    7,
    0,
    0,
    0
  );

  const end =
    new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 1
  );

  return {
    start,
    end,
  };
}

function getWeekRange() {
  const now = new Date();

  const businessNow =
    new Date(now);

  if (
    businessNow.getUTCHours() <
    7
  ) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() -
        1
    );
  }

  /*
   * Même logique que la page Ventes :
   * lundi 07h00 → lundi suivant 07h00.
   */
  const day =
    businessNow.getUTCDay();

  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

  const start =
    new Date(businessNow);

  start.setUTCDate(
    start.getUTCDate() -
      daysSinceMonday
  );

  start.setUTCHours(
    7,
    0,
    0,
    0
  );

  const end =
    new Date(start);

  end.setUTCDate(
    end.getUTCDate() + 7
  );

  return {
    start,
    end,
  };
}

function getMonthRange() {
  const now = new Date();

  const businessNow =
    new Date(now);

  if (
    businessNow.getUTCHours() <
    7
  ) {
    businessNow.setUTCDate(
      businessNow.getUTCDate() -
        1
    );
  }

  const start =
    new Date(
      Date.UTC(
        businessNow.getUTCFullYear(),
        businessNow.getUTCMonth(),
        1,
        7,
        0,
        0
      )
    );

  const end =
    new Date(
      Date.UTC(
        businessNow.getUTCFullYear(),
        businessNow.getUTCMonth() +
          1,
        1,
        7,
        0,
        0
      )
    );

  return {
    start,
    end,
  };
}

function getRange(
  period: Period
) {
  if (
    period === "today"
  ) {
    return getBusinessDayRange();
  }

  if (
    period === "week"
  ) {
    return getWeekRange();
  }

  if (
    period === "month"
  ) {
    return getMonthRange();
  }

  return null;
}

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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatTime(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleTimeString(
    "fr-FR",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function parseShiftPayload(
  payload: unknown
): ShiftSummaryPayload {
  if (
    typeof payload === "string"
  ) {
    try {
      return JSON.parse(
        payload
      );
    } catch {
      return {};
    }
  }

  if (
    payload &&
    typeof payload === "object"
  ) {
    return payload as ShiftSummaryPayload;
  }

  return {};
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
  }>;
}) {
  const params =
    await searchParams;

  const selectedPeriod: Period =
    params.period === "week"
      ? "week"
      : params.period === "month"
      ? "month"
      : params.period === "all"
      ? "all"
      : "today";

  const range =
    getRange(
      selectedPeriod
    );

  /*
   * ============================
   * COMMANDES PAYÉES
   * ============================
   */
  let paidOrdersQuery =
    supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        table_id,
        order_type,
        cashier_id,
        total,
        payment_method,
        paid_at
      `)
      .eq(
        "status",
        "paid"
      )
      .order(
        "paid_at",
        {
          ascending: false,
        }
      );

  if (range) {
    paidOrdersQuery =
      paidOrdersQuery
        .gte(
          "paid_at",
          range.start.toISOString()
        )
        .lt(
          "paid_at",
          range.end.toISOString()
        );
  }

  /*
   * ============================
   * COMMANDES ANNULÉES
   * ============================
   */
  let cancelledOrdersQuery =
    supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        table_id,
        order_type,
        cashier_id,
        cancelled_by,
        cancellation_reason,
        cancelled_at,
        sent_to_kitchen_at
      `)
      .eq(
        "status",
        "cancelled"
      )
      .order(
        "cancelled_at",
        {
          ascending: false,
        }
      );

  if (range) {
    cancelledOrdersQuery =
      cancelledOrdersQuery
        .gte(
          "cancelled_at",
          range.start.toISOString()
        )
        .lt(
          "cancelled_at",
          range.end.toISOString()
        );
  }

  /*
   * ============================
   * ANNULATIONS D'ARTICLES
   * ============================
   */
  let itemCancellationsQuery =
    supabaseAdmin
      .from(
        "order_item_cancellations"
      )
      .select(`
        id,
        order_id,
        order_item_id,
        quantity,
        reason,
        after_kitchen,
        cashier_id,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (range) {
    itemCancellationsQuery =
      itemCancellationsQuery
        .gte(
          "created_at",
          range.start.toISOString()
        )
        .lt(
          "created_at",
          range.end.toISOString()
        );
  }

  /*
   * ============================
   * RAPPORTS DE SHIFTS
   * ============================
   */
  let shiftReportsQuery =
    supabaseAdmin
      .from(
        "print_jobs"
      )
      .select(`
        id,
        shift_id,
        payload,
        created_at
      `)
      .eq(
        "job_type",
        "shift_summary"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (range) {
    shiftReportsQuery =
      shiftReportsQuery
        .gte(
          "created_at",
          range.start.toISOString()
        )
        .lt(
          "created_at",
          range.end.toISOString()
        );
  }

  const [
    paidOrdersResult,
    cancelledOrdersResult,
    itemCancellationsResult,
    shiftReportsResult,
  ] =
    await Promise.all([
      paidOrdersQuery,
      cancelledOrdersQuery,
      itemCancellationsQuery,
      shiftReportsQuery,
    ]);

  if (
    paidOrdersResult.error ||
    cancelledOrdersResult.error ||
    itemCancellationsResult.error ||
    shiftReportsResult.error
  ) {
    console.error(
      "ADMIN REPORTS ERROR:",
      {
        paid:
          paidOrdersResult.error,
        cancelled:
          cancelledOrdersResult.error,
        itemCancellations:
          itemCancellationsResult.error,
        shifts:
          shiftReportsResult.error,
      }
    );

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

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            Impossible de
            charger les rapports.
          </div>
        </div>
      </main>
    );
  }

  const paidOrders =
    paidOrdersResult.data ||
    [];

  const cancelledOrders =
    cancelledOrdersResult.data ||
    [];

  const itemCancellations =
    itemCancellationsResult.data ||
    [];

  const shiftReports =
    shiftReportsResult.data ||
    [];

  /*
   * ============================
   * COMMANDES CONCERNÉES
   * ============================
   */
  const orderIds = [
    ...new Set([
      ...paidOrders.map(
        (order) => order.id
      ),

      ...cancelledOrders.map(
        (order) => order.id
      ),

      ...itemCancellations.map(
        (cancellation) =>
          cancellation.order_id
      ),
    ]),
  ].filter(Boolean);

  let allOrders:
    any[] = [];

  if (
    orderIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("orders")
        .select(`
          id,
          order_number,
          table_id,
          order_type,
          cashier_id,
          status
        `)
        .in(
          "id",
          orderIds
        );

    if (error) {
      console.error(
        "REPORT ORDERS ERROR:",
        error
      );
    } else {
      allOrders =
        data || [];
    }
  }

  const ordersMap =
    new Map<
      string,
      any
    >();

  for (
    const order of
    allOrders
  ) {
    ordersMap.set(
      order.id,
      order
    );
  }

  /*
   * ============================
   * ARTICLES DES COMMANDES
   * ============================
   */
  let orderItems:
    any[] = [];

  if (
    orderIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("order_items")
        .select(`
          id,
          order_id,
          menu_item_id,
          quantity,
          unit_price,
          sent_quantity
        `)
        .in(
          "order_id",
          orderIds
        );

    if (error) {
      console.error(
        "REPORT ITEMS ERROR:",
        error
      );
    } else {
      orderItems =
        data || [];
    }
  }

  const orderItemMap =
    new Map<
      string,
      any
    >();

  for (
    const item of
    orderItems
  ) {
    orderItemMap.set(
      item.id,
      item
    );
  }

  /*
   * ============================
   * PRODUITS DU MENU
   * ============================
   */
  const menuItemIds = [
    ...new Set(
      orderItems
        .map(
          (item) =>
            item.menu_item_id
        )
        .filter(Boolean)
    ),
  ];

  let menuItems:
    any[] = [];

  if (
    menuItemIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("menu_items")
        .select(`
          id,
          name,
          category
        `)
        .in(
          "id",
          menuItemIds
        );

    if (error) {
      console.error(
        "REPORT MENU ERROR:",
        error
      );
    } else {
      menuItems =
        data || [];
    }
  }

  const menuMap =
    new Map<
      string,
      any
    >();

  for (
    const item of
    menuItems
  ) {
    menuMap.set(
      item.id,
      item
    );
  }

  /*
   * ============================
   * UTILISATEURS
   * ============================
   */
  const userIds = [
    ...new Set([
      ...paidOrders.map(
        (order) =>
          order.cashier_id
      ),

      ...cancelledOrders.map(
        (order) =>
          order.cancelled_by
      ),

      ...itemCancellations.map(
        (cancellation) =>
          cancellation.cashier_id
      ),
    ]),
  ].filter(Boolean);

  let users:
    any[] = [];

  if (
    userIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("users")
        .select(`
          id,
          name
        `)
        .in(
          "id",
          userIds
        );

    if (error) {
      console.error(
        "REPORT USERS ERROR:",
        error
      );
    } else {
      users =
        data || [];
    }
  }

  const usersMap =
    new Map<
      string,
      string
    >();

  for (
    const user of users
  ) {
    usersMap.set(
      user.id,
      user.name
    );
  }

  /*
   * ============================
   * TABLES
   * ============================
   */
  const tableIds = [
    ...new Set(
      allOrders
        .map(
          (order) =>
            order.table_id
        )
        .filter(Boolean)
    ),
  ];

  let tables:
    any[] = [];

  if (
    tableIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "restaurant_tables"
        )
        .select(`
          id,
          name
        `)
        .in(
          "id",
          tableIds
        );

    if (error) {
      console.error(
        "REPORT TABLES ERROR:",
        error
      );
    } else {
      tables =
        data || [];
    }
  }

  const tablesMap =
    new Map<
      string,
      string
    >();

  for (
    const table of tables
  ) {
    tablesMap.set(
      table.id,
      table.name
    );
  }

  const getOrderLocation = (
    orderId: string
  ) => {
    const order =
      ordersMap.get(
        orderId
      );

    if (!order) {
      return "Commande";
    }

    if (
      order.order_type ===
      "takeaway"
    ) {
      return "À emporter";
    }

    return (
      tablesMap.get(
        order.table_id
      ) ||
      "Table"
    );
  };

  /*
   * ============================
   * CA / COMMANDES / PAIEMENTS
   * ============================
   */
  const revenue =
    paidOrders.reduce(
      (
        sum,
        order
      ) =>
        sum +
        Number(
          order.total || 0
        ),
      0
    );

  const paidOrderCount =
    paidOrders.length;

  const averageOrder =
    paidOrderCount > 0
      ? Math.round(
          revenue /
            paidOrderCount
        )
      : 0;

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
    paidOrders
  ) {
    if (
      order.payment_method
    ) {
      paymentTotals[
        order.payment_method
      ] =
        (paymentTotals[
          order.payment_method
        ] || 0) +
        Number(
          order.total || 0
        );
    }
  }

  /*
   * ============================
   * VENTES PAR CAISSIER
   * ============================
   */
  const cashierStats =
    new Map<
      string,
      {
        id: string;
        name: string;
        orders: number;
        revenue: number;
      }
    >();

  for (
    const order of
    paidOrders
  ) {
    const cashierId =
      order.cashier_id ||
      "unknown";

    const current =
      cashierStats.get(
        cashierId
      ) || {
        id:
          cashierId,

        name:
          usersMap.get(
            cashierId
          ) ||
          "Caissier",

        orders: 0,

        revenue: 0,
      };

    current.orders +=
      1;

    current.revenue +=
      Number(
        order.total || 0
      );

    cashierStats.set(
      cashierId,
      current
    );
  }

  const cashierRows =
    Array.from(
      cashierStats.values()
    ).sort(
      (
        a,
        b
      ) =>
        b.revenue -
        a.revenue
    );

  /*
   * ============================
   * PRODUITS VENDUS / ANNULÉS
   * ============================
   */
  const productStats =
    new Map<
      string,
      ProductStat
    >();

  const addProduct = (
    menuItemId: string,
    sold: number,
    cancelled: number
  ) => {
    if (
      sold <= 0 &&
      cancelled <= 0
    ) {
      return;
    }

    const menuItem =
      menuMap.get(
        menuItemId
      );

    const current =
      productStats.get(
        menuItemId
      ) || {
        id:
          menuItemId,

        name:
          menuItem?.name ||
          "Produit",

        category:
          menuItem?.category ||
          "",

        sold: 0,
        cancelled: 0,
      };

    current.sold +=
      sold;

    current.cancelled +=
      cancelled;

    productStats.set(
      menuItemId,
      current
    );
  };

  const paidOrderIds =
    new Set(
      paidOrders.map(
        (order) =>
          order.id
      )
    );

  const cancelledOrderIds =
    new Set(
      cancelledOrders.map(
        (order) =>
          order.id
      )
    );

  /*
   * Produits réellement vendus.
   */
  for (
    const item of
    orderItems
  ) {
    if (
      paidOrderIds.has(
        item.order_id
      )
    ) {
      addProduct(
        item.menu_item_id,
        Number(
          item.quantity || 0
        ),
        0
      );
    }
  }

  /*
   * Produits restant dans une
   * commande entièrement annulée.
   */
  for (
    const item of
    orderItems
  ) {
    if (
      cancelledOrderIds.has(
        item.order_id
      )
    ) {
      addProduct(
        item.menu_item_id,
        0,
        Number(
          item.quantity || 0
        )
      );
    }
  }

  /*
   * Annulations partielles.
   */
  for (
    const cancellation of
    itemCancellations
  ) {
    const item =
      orderItemMap.get(
        cancellation.order_item_id
      );

    if (!item) {
      continue;
    }

    addProduct(
      item.menu_item_id,
      0,
      Number(
        cancellation.quantity ||
          0
      )
    );
  }

  const productRows =
    Array.from(
      productStats.values()
    ).sort(
      (
        a,
        b
      ) =>
        b.sold +
          b.cancelled -
        (a.sold +
          a.cancelled)
    );

  const totalSoldItems =
    productRows.reduce(
      (
        sum,
        product
      ) =>
        sum +
        product.sold,
      0
    );

  const totalCancelledItems =
    productRows.reduce(
      (
        sum,
        product
      ) =>
        sum +
        product.cancelled,
      0
    );

  /*
   * ============================
   * VALEUR ANNULÉE
   * ============================
   */
  let cancelledValue =
    0;

  /*
   * Annulations partielles.
   */
  for (
    const cancellation of
    itemCancellations
  ) {
    const item =
      orderItemMap.get(
        cancellation.order_item_id
      );

    if (!item) {
      continue;
    }

    cancelledValue +=
      Number(
        cancellation.quantity ||
          0
      ) *
      Number(
        item.unit_price || 0
      );
  }

  /*
   * Quantités restantes lors
   * d'une annulation complète.
   */
  for (
    const item of
    orderItems
  ) {
    if (
      cancelledOrderIds.has(
        item.order_id
      )
    ) {
      cancelledValue +=
        Number(
          item.quantity || 0
        ) *
        Number(
          item.unit_price || 0
        );
    }
  }

  /*
   * ============================
   * AVANT / APRÈS CUISINE
   * ============================
   */
  let cancelledBeforeKitchen =
    0;

  let cancelledAfterKitchen =
    0;

  /*
   * Annulations partielles.
   */
  for (
    const cancellation of
    itemCancellations
  ) {
    const quantity =
      Number(
        cancellation.quantity ||
          0
      );

    if (
      cancellation.after_kitchen
    ) {
      cancelledAfterKitchen +=
        quantity;
    } else {
      cancelledBeforeKitchen +=
        quantity;
    }
  }

  /*
   * Commandes entièrement annulées :
   * on regarde les quantités qui avaient
   * réellement déjà été envoyées.
   */
  for (
    const item of
    orderItems
  ) {
    if (
      !cancelledOrderIds.has(
        item.order_id
      )
    ) {
      continue;
    }

    const quantity =
      Number(
        item.quantity || 0
      );

    const sentQuantity =
      Math.min(
        Number(
          item.sent_quantity ||
            0
        ),
        quantity
      );

    cancelledAfterKitchen +=
      sentQuantity;

    cancelledBeforeKitchen +=
      Math.max(
        quantity -
          sentQuantity,
        0
      );
  }

  /*
   * ============================
   * REGROUPER LES ANNULATIONS
   * D'ARTICLES D'UNE MÊME ACTION
   * ============================
   */
  const groupedItemCancellations =
    new Map<
      string,
      {
        orderId: string;
        orderItemId: string;
        reason: string;
        cashierId: string;
        createdAt: string;
        beforeKitchen: number;
        afterKitchen: number;
      }
    >();

  for (
    const cancellation of
    itemCancellations
  ) {
    const key = [
      cancellation.order_id,
      cancellation.order_item_id,
      cancellation.reason,
      cancellation.cashier_id,
      cancellation.created_at,
    ].join("|");

    const current =
      groupedItemCancellations.get(
        key
      ) || {
        orderId:
          cancellation.order_id,

        orderItemId:
          cancellation.order_item_id,

        reason:
          cancellation.reason ||
          "Autre",

        cashierId:
          cancellation.cashier_id,

        createdAt:
          cancellation.created_at,

        beforeKitchen: 0,

        afterKitchen: 0,
      };

    if (
      cancellation.after_kitchen
    ) {
      current.afterKitchen +=
        Number(
          cancellation.quantity ||
            0
        );
    } else {
      current.beforeKitchen +=
        Number(
          cancellation.quantity ||
            0
        );
    }

    groupedItemCancellations.set(
      key,
      current
    );
  }

  /*
   * ============================
   * MOTIFS
   * ============================
   */
  const reasonStats =
    new Map<
      string,
      number
    >();

  const addReason = (
    reason?: string | null
  ) => {
    const cleanReason =
      reason?.trim() ||
      "Autre";

    reasonStats.set(
      cleanReason,
      (reasonStats.get(
        cleanReason
      ) || 0) + 1
    );
  };

  for (
    const order of
    cancelledOrders
  ) {
    addReason(
      order.cancellation_reason
    );
  }

  for (
    const cancellation of
    groupedItemCancellations.values()
  ) {
    addReason(
      cancellation.reason
    );
  }

  const reasonRows =
    Array.from(
      reasonStats.entries()
    )
      .map(
        ([
          reason,
          count,
        ]) => ({
          reason,
          count,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      );

  /*
   * ============================
   * HISTORIQUE ANNULATIONS
   * ============================
   */
  const cancellationHistory:
    CancellationHistoryItem[] =
      [];

  /*
   * Commandes complètes.
   */
  for (
    const order of
    cancelledOrders
  ) {
    const relatedItems =
      orderItems.filter(
        (item) =>
          item.order_id ===
          order.id
      );

    let beforeKitchen =
      0;

    let afterKitchen =
      0;

    for (
      const item of
      relatedItems
    ) {
      const quantity =
        Number(
          item.quantity ||
            0
        );

      const sent =
        Math.min(
          Number(
            item.sent_quantity ||
              0
          ),
          quantity
        );

      afterKitchen +=
        sent;

      beforeKitchen +=
        Math.max(
          quantity -
            sent,
          0
        );
    }

    const quantity =
      beforeKitchen +
      afterKitchen;

    cancellationHistory.push({
      key:
        `order-${order.id}`,

      orderId:
        order.id,

      orderNumber:
        order.order_number,

      location:
        getOrderLocation(
          order.id
        ),

      date:
        order.cancelled_at,

      type:
        "order",

      label:
        "Commande complète",

      reason:
        order.cancellation_reason ||
        "Autre",

      cashier:
        usersMap.get(
          order.cancelled_by
        ) ||
        "Caissier",

      quantity,

      beforeKitchen,

      afterKitchen,
    });
  }

  /*
   * Articles.
   */
  for (
    const [
      key,
      cancellation,
    ] of
    groupedItemCancellations
  ) {
    const item =
      orderItemMap.get(
        cancellation.orderItemId
      );

    const menuItem =
      item
        ? menuMap.get(
            item.menu_item_id
          )
        : null;

    const order =
      ordersMap.get(
        cancellation.orderId
      );

    cancellationHistory.push({
      key:
        `item-${key}`,

      orderId:
        cancellation.orderId,

      orderNumber:
        order?.order_number ||
        null,

      location:
        getOrderLocation(
          cancellation.orderId
        ),

      date:
        cancellation.createdAt,

      type:
        "item",

      label:
        menuItem?.name ||
        "Article",

      reason:
        cancellation.reason,

      cashier:
        usersMap.get(
          cancellation.cashierId
        ) ||
        "Caissier",

      quantity:
        cancellation.beforeKitchen +
        cancellation.afterKitchen,

      beforeKitchen:
        cancellation.beforeKitchen,

      afterKitchen:
        cancellation.afterKitchen,
    });
  }

  cancellationHistory.sort(
    (
      a,
      b
    ) =>
      new Date(
        b.date
      ).getTime() -
      new Date(
        a.date
      ).getTime()
  );

  /*
   * ============================
   * RAPPORTS DE SHIFTS
   * ============================
   */
  const shiftRows =
    shiftReports.map(
      (report) => ({
        id:
          report.id,

        shiftId:
          report.shift_id,

        payload:
          parseShiftPayload(
            report.payload
          ),
      })
    );

  const cancelledOrderCount =
    cancelledOrders.length;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-sky-600"
          >
            ← Retour à
            l&apos;administration
          </Link>

          <div className="mt-3">
            <p className="text-sm text-slate-500">
              Analyse de
              l&apos;activité
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Rapports
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Journée commerciale :
              07h00 → 07h00
            </p>
          </div>
        </header>

        {/* FILTRES */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {[
            {
              value:
                "today",
              label:
                "Aujourd'hui",
            },
            {
              value:
                "week",
              label:
                "Cette semaine",
            },
            {
              value:
                "month",
              label:
                "Ce mois",
            },
            {
              value:
                "all",
              label:
                "Tout",
            },
          ].map(
            (item) => (
              <Link
                key={
                  item.value
                }
                href={`/admin/reports?period=${item.value}`}
                className={
                  selectedPeriod ===
                  item.value
                    ? "whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 font-medium text-white"
                    : "whitespace-nowrap rounded-xl bg-white px-4 py-2 font-medium text-slate-700 shadow-sm"
                }
              >
                {
                  item.label
                }
              </Link>
            )
          )}
        </div>

        {/* KPI CAISSE */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Caisse
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Chiffre
                d&apos;affaires
              </p>

              <p className="mt-2 text-2xl font-bold">
                {formatMoney(
                  revenue
                )}{" "}
                MRU
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Commandes payées
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  paidOrderCount
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Ticket moyen
              </p>

              <p className="mt-2 text-2xl font-bold">
                {formatMoney(
                  averageOrder
                )}{" "}
                MRU
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Commandes
                annulées
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {
                  cancelledOrderCount
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Valeur annulée
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {formatMoney(
                  cancelledValue
                )}{" "}
                MRU
              </p>
            </div>
          </div>
        </section>

        {/* PAIEMENTS + CAISSIERS */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">
              Moyens de paiement
            </h2>

            <div className="mt-4 space-y-2">
              {paymentMethods.map(
                (method) => (
                  <div
                    key={
                      method
                    }
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span>
                      {method}
                    </span>

                    <span className="font-semibold">
                      {formatMoney(
                        paymentTotals[
                          method
                        ] || 0
                      )}{" "}
                      MRU
                    </span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">
              Par caissier
            </h2>

            {cashierRows.length ===
            0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Aucune vente sur
                cette période.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {cashierRows.map(
                  (
                    cashier
                  ) => (
                    <div
                      key={
                        cashier.id
                      }
                      className="rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">
                          {
                            cashier.name
                          }
                        </span>

                        <span className="font-semibold">
                          {formatMoney(
                            cashier.revenue
                          )}{" "}
                          MRU
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          cashier.orders
                        }{" "}
                        commande
                        {cashier.orders >
                        1
                          ? "s"
                          : ""}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        {/* PRODUITS */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Produits
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Produits du menu
                  vendus et annulés
                </p>
              </div>

              <div className="flex gap-4 text-sm">
                <span>
                  Vendus :{" "}
                  <strong>
                    {
                      totalSoldItems
                    }
                  </strong>
                </span>

                <span>
                  Annulés :{" "}
                  <strong className="text-red-600">
                    {
                      totalCancelledItems
                    }
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {productRows.length ===
          0 ? (
            <p className="p-6 text-slate-500">
              Aucun produit sur
              cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 text-left text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Produit
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Catégorie
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Vendus
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Annulés
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {productRows.map(
                    (
                      product
                    ) => (
                      <tr
                        key={
                          product.id
                        }
                      >
                        <td className="px-5 py-4 font-medium">
                          {
                            product.name
                          }
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {
                            product.category
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          {
                            product.sold
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-red-600">
                          {
                            product.cancelled
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ANNULATIONS */}
        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-xl font-semibold">
              Annulations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Suivi des commandes
              et articles annulés
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Commandes
                annulées
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  cancelledOrderCount
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Articles annulés
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  totalCancelledItems
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Avant cuisine
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {
                  cancelledBeforeKitchen
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Après cuisine
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {
                  cancelledAfterKitchen
                }
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* MOTIFS */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">
                Motifs
              </h3>

              {reasonRows.length ===
              0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Aucune annulation.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {reasonRows.map(
                    (
                      reason
                    ) => (
                      <div
                        key={
                          reason.reason
                        }
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <span className="text-sm">
                          {
                            reason.reason
                          }
                        </span>

                        <span className="font-semibold">
                          {
                            reason.count
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* HISTORIQUE */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b p-5">
                <h3 className="text-lg font-semibold">
                  Historique des
                  annulations
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    cancellationHistory.length
                  }{" "}
                  événement
                  {cancellationHistory.length >
                  1
                    ? "s"
                    : ""}
                </p>
              </div>

              {cancellationHistory.length ===
              0 ? (
                <p className="p-6 text-slate-500">
                  Aucune annulation
                  sur cette période.
                </p>
              ) : (
                <div className="divide-y">
                  {cancellationHistory.map(
                    (
                      cancellation
                    ) => (
                      <Link
                        key={
                          cancellation.key
                        }
                        href={`/admin/orders/${cancellation.orderId}`}
                        className="block p-5 transition hover:bg-slate-50"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {
                                  cancellation.label
                                }
                              </p>

                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                {cancellation.type ===
                                "order"
                                  ? "Commande annulée"
                                  : "Article annulé"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              {cancellation.orderNumber
                                ? `Commande #${cancellation.orderNumber} · `
                                : ""}
                              {
                                cancellation.location
                              }
                            </p>

                            <p className="mt-2 text-sm">
                              Motif :{" "}
                              <span className="font-medium">
                                {
                                  cancellation.reason
                                }
                              </span>
                            </p>

                            {cancellation.quantity >
                              0 && (
                              <p className="mt-1 text-sm text-slate-500">
                                Quantité :
                                {" "}
                                {
                                  cancellation.quantity
                                }
                              </p>
                            )}

                            {(cancellation.beforeKitchen >
                              0 ||
                              cancellation.afterKitchen >
                                0) && (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {cancellation.beforeKitchen >
                                  0 && (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                    Avant cuisine :{" "}
                                    {
                                      cancellation.beforeKitchen
                                    }
                                  </span>
                                )}

                                {cancellation.afterKitchen >
                                  0 && (
                                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                                    Après cuisine :{" "}
                                    {
                                      cancellation.afterKitchen
                                    }
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-sm font-medium">
                              {
                                cancellation.cashier
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatDateTime(
                                cancellation.date
                              )}
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SHIFTS */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Rapports de shifts
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Récapitulatifs
                générés à la
                clôture des caisses
              </p>
            </div>

            <Link
              href="/admin/shifts"
              className="text-sm font-medium text-sky-600"
            >
              Voir les shifts →
            </Link>
          </div>

          {shiftRows.length ===
          0 ? (
            <p className="p-6 text-slate-500">
              Aucun rapport de
              shift sur cette
              période.
            </p>
          ) : (
            <div className="divide-y">
              {shiftRows.map(
                (
                  report
                ) => {
                  const payload =
                    report.payload;

                  return (
                    <div
                      key={
                        report.id
                      }
                      className="p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {payload
                              .cashier
                              ?.name ||
                              "Caissier"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatDateTime(
                              payload.startedAt
                            )}
                            {" → "}
                            {formatTime(
                              payload.endedAt
                            )}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {payload.paidOrderCount ||
                              0}{" "}
                            commande
                            {(payload.paidOrderCount ||
                              0) >
                            1
                              ? "s"
                              : ""}{" "}
                            payée
                            {(payload.paidOrderCount ||
                              0) >
                            1
                              ? "s"
                              : ""}
                            {" · "}
                            {payload.cancelledOrderCount ||
                              0}{" "}
                            annulée
                            {(payload.cancelledOrderCount ||
                              0) >
                            1
                              ? "s"
                              : ""}
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-sm text-slate-500">
                            CA du shift
                          </p>

                          <p className="mt-1 text-xl font-bold">
                            {formatMoney(
                              Number(
                                payload.revenue ||
                                  0
                              )
                            )}{" "}
                            MRU
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}