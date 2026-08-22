import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Period =
  | "today"
  | "week"
  | "month"
  | "range";

type MonthOption = {
  value: string;
  label: string;
};

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
      businessNow.getUTCDate() - 1
    );
  }

  const day =
    businessNow.getUTCDay();

  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

  const start =
    new Date(
      businessNow
    );

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

function getBusinessDate(
  source = new Date()
) {
  const date =
    new Date(source);

  if (
    date.getUTCHours() < 7
  ) {
    date.setUTCDate(
      date.getUTCDate() - 1
    );
  }

  return date;
}

function getMonthKey(
  date: Date
) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  return `${year}-${month}`;
}

function getBusinessMonthKey(
  date: Date
) {
  return getMonthKey(
    getBusinessDate(date)
  );
}

function isMonthKey(
  value?: string
) {
  return Boolean(
    value &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(
        value
      )
  );
}

function parseMonthKey(
  value: string
) {
  const [
    yearText,
    monthText,
  ] = value.split("-");

  return {
    year:
      Number(yearText),

    month:
      Number(monthText) - 1,
  };
}

function capitalizeFirst(
  value: string
) {
  if (!value) {
    return value;
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatMonthLabel(
  value: string
) {
  const {
    year,
    month,
  } = parseMonthKey(
    value
  );

  const date =
    new Date(
      Date.UTC(
        year,
        month,
        1,
        12,
        0,
        0
      )
    );

  return capitalizeFirst(
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }
    ).format(date)
  );
}

function formatDateLabel(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function buildMonthOptions(
  firstMonthKey: string,
  currentMonthKey: string
): MonthOption[] {
  const first =
    parseMonthKey(
      firstMonthKey
    );

  const current =
    parseMonthKey(
      currentMonthKey
    );

  const firstDate =
    new Date(
      Date.UTC(
        first.year,
        first.month,
        1,
        12,
        0,
        0
      )
    );

  const cursor =
    new Date(
      Date.UTC(
        current.year,
        current.month,
        1,
        12,
        0,
        0
      )
    );

  const result:
    MonthOption[] = [];

  let safety = 0;

  while (
    cursor.getTime() >=
      firstDate.getTime() &&
    safety < 1200
  ) {
    const value =
      getMonthKey(
        cursor
      );

    result.push({
      value,
      label:
        formatMonthLabel(
          value
        ),
    });

    cursor.setUTCMonth(
      cursor.getUTCMonth() - 1
    );

    safety += 1;
  }

  if (
    result.length === 0
  ) {
    result.push({
      value:
        currentMonthKey,

      label:
        formatMonthLabel(
          currentMonthKey
        ),
    });
  }

  return result;
}

function getMonthRange(
  monthKey: string,
  currentMonthKey: string
) {
  const {
    year,
    month,
  } = parseMonthKey(
    monthKey
  );

  const start =
    new Date(
      Date.UTC(
        year,
        month,
        1,
        7,
        0,
        0
      )
    );

  const naturalEnd =
    new Date(
      Date.UTC(
        year,
        month + 1,
        1,
        7,
        0,
        0
      )
    );

  const end =
    monthKey ===
    currentMonthKey
      ? new Date()
      : naturalEnd;

  return {
    start,
    end,
  };
}

function getCustomRange(
  fromMonth: string,
  toMonth: string,
  currentMonthKey: string
) {
  const from =
    getMonthRange(
      fromMonth,
      currentMonthKey
    );

  const to =
    getMonthRange(
      toMonth,
      currentMonthKey
    );

  return {
    start: from.start,
    end: to.end,
  };
}

function getRange(
  period: Period,
  selectedMonth: string,
  selectedFromMonth: string,
  selectedToMonth: string,
  currentMonthKey: string
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
    return getMonthRange(
      selectedMonth,
      currentMonthKey
    );
  }

  return getCustomRange(
    selectedFromMonth,
    selectedToMonth,
    currentMonthKey
  );
}

function getPeriodLabel(
  period: Period,
  selectedMonth: string,
  selectedFromMonth: string,
  selectedToMonth: string
) {
  if (
    period === "week"
  ) {
    return "Cette semaine";
  }

  if (
    period === "month"
  ) {
    return formatMonthLabel(
      selectedMonth
    );
  }

  if (
    period === "range"
  ) {
    if (
      selectedFromMonth ===
      selectedToMonth
    ) {
      return formatMonthLabel(
        selectedFromMonth
      );
    }

    return `${formatMonthLabel(
      selectedFromMonth
    )} → ${formatMonthLabel(
      selectedToMonth
    )}`;
  }

  return "Aujourd’hui";
}

function getExactRangeLabel(
  period: Period,
  selectedMonth: string,
  selectedFromMonth: string,
  selectedToMonth: string,
  currentMonthKey: string
) {
  if (
    period !== "month" &&
    period !== "range"
  ) {
    return null;
  }

  const fromMonth =
    period === "month"
      ? selectedMonth
      : selectedFromMonth;

  const toMonth =
    period === "month"
      ? selectedMonth
      : selectedToMonth;

  const startRange =
    getMonthRange(
      fromMonth,
      currentMonthKey
    );

  if (
    toMonth ===
    currentMonthKey
  ) {
    return `Du ${formatDateLabel(
      startRange.start
    )} à aujourd’hui`;
  }

  const endRange =
    getMonthRange(
      toMonth,
      currentMonthKey
    );

  const lastDay =
    new Date(
      endRange.end.getTime() -
        24 *
          60 *
          60 *
          1000
    );

  return `Du ${formatDateLabel(
    startRange.start
  )} au ${formatDateLabel(
    lastDay
  )}`;
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
      timeZone:
        "Africa/Nouakchott",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function parseShiftPayload(
  payload: unknown
): ShiftSummaryPayload {
  if (
    typeof payload ===
    "string"
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
    typeof payload ===
      "object"
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
    month?: string;
    from?: string;
    to?: string;
  }>;
}) {
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

  const params =
    await searchParams;

  /*
   * ============================
   * MOIS DISPONIBLES
   * ============================
   */
  const now =
    new Date();

  const currentMonthKey =
    getBusinessMonthKey(
      now
    );

  const {
    data: firstSale,
    error: firstSaleError,
  } = await supabaseAdmin
    .from("orders")
    .select("paid_at")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "status",
      "paid"
    )
    .not(
      "paid_at",
      "is",
      null
    )
    .order(
      "paid_at",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  if (
    firstSaleError
  ) {
    console.error(
      "ADMIN REPORTS FIRST SALE ERROR:",
      firstSaleError
    );
  }

  const firstMonthKey =
    firstSale?.paid_at
      ? getBusinessMonthKey(
          new Date(
            firstSale.paid_at
          )
        )
      : currentMonthKey;

  const monthOptions =
    buildMonthOptions(
      firstMonthKey,
      currentMonthKey
    );

  const availableMonthKeys =
    new Set(
      monthOptions.map(
        (month) =>
          month.value
      )
    );

  /*
   * ============================
   * FILTRE SÉLECTIONNÉ
   * ============================
   */
  const selectedPeriod: Period =
    params.period === "week"
      ? "week"
      : params.period ===
          "month"
        ? "month"
        : params.period ===
              "range" ||
            params.period ===
              "all"
          ? "range"
          : "today";

  const selectedMonth =
    isMonthKey(
      params.month
    ) &&
    availableMonthKeys.has(
      params.month!
    )
      ? params.month!
      : currentMonthKey;

  let selectedFromMonth =
    isMonthKey(
      params.from
    ) &&
    availableMonthKeys.has(
      params.from!
    )
      ? params.from!
      : firstMonthKey;

  let selectedToMonth =
    isMonthKey(
      params.to
    ) &&
    availableMonthKeys.has(
      params.to!
    )
      ? params.to!
      : currentMonthKey;

  if (
    selectedFromMonth >
    selectedToMonth
  ) {
    const temporary =
      selectedFromMonth;

    selectedFromMonth =
      selectedToMonth;

    selectedToMonth =
      temporary;
  }

  const range =
    getRange(
      selectedPeriod,
      selectedMonth,
      selectedFromMonth,
      selectedToMonth,
      currentMonthKey
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
        "restaurant_id",
        restaurantId
      )
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
        "restaurant_id",
        restaurantId
      )
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
      .eq(
        "restaurant_id",
        restaurantId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

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
        "restaurant_id",
        restaurantId
      )
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
              Rapports
              indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de
              récupérer les données
              pour le moment.
            </p>

            <a
              href="/admin/reports"
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
        (order) =>
          order.id
      ),

      ...cancelledOrders.map(
        (order) =>
          order.id
      ),

      ...itemCancellations.map(
        (cancellation) =>
          cancellation.order_id
      ),
    ]),
  ].filter(Boolean);

  let allOrders: any[] =
    [];

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
        .eq(
          "restaurant_id",
          restaurantId
        )
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
  let orderItems: any[] =
    [];

  if (
    orderIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "order_items"
        )
        .select(`
          id,
          order_id,
          menu_item_id,
          quantity,
          unit_price,
          sent_quantity
        `)
        .eq(
          "restaurant_id",
          restaurantId
        )
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
   * PRODUITS
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

  let menuItems: any[] =
    [];

  if (
    menuItemIds.length > 0
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
        .eq(
          "restaurant_id",
          restaurantId
        )
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

  let users: any[] = [];

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
        .eq(
          "restaurant_id",
          restaurantId
        )
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

  let tables: any[] = [];

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
        .eq(
          "restaurant_id",
          restaurantId
        )
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
        id: cashierId,

        name:
          usersMap.get(
            cashierId
          ) ||
          "Caissier",

        orders: 0,

        revenue: 0,
      };

    current.orders += 1;

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
      (a, b) =>
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
        id: menuItemId,

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
      (a, b) =>
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
  let cancelledValue = 0;

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
   * REGROUPEMENT ANNULATIONS
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
        (a, b) =>
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

    let beforeKitchen = 0;
    let afterKitchen = 0;

    for (
      const item of
      relatedItems
    ) {
      const quantity =
        Number(
          item.quantity || 0
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
          quantity - sent,
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
    (a, b) =>
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

  const totalOrderDecisions =
    paidOrderCount +
    cancelledOrderCount;

  const cancellationRate =
    totalOrderDecisions > 0
      ? Math.round(
          (cancelledOrderCount /
            totalOrderDecisions) *
            100
        )
      : 0;

  const totalCancellationUnits =
    cancelledBeforeKitchen +
    cancelledAfterKitchen;

  const afterKitchenRate =
    totalCancellationUnits > 0
      ? Math.round(
          (cancelledAfterKitchen /
            totalCancellationUnits) *
            100
        )
      : 0;

  const getPaymentPercentage = (
    amount: number
  ) => {
    if (revenue <= 0) {
      return 0;
    }

    return Math.round(
      (amount / revenue) *
        100
    );
  };

  const maxCashierRevenue =
    cashierRows.length > 0
      ? Math.max(
          ...cashierRows.map(
            (cashier) =>
              cashier.revenue
          )
        )
      : 0;

  const periodLabel =
    getPeriodLabel(
      selectedPeriod,
      selectedMonth,
      selectedFromMonth,
      selectedToMonth
    );

  const exactRangeLabel =
    getExactRangeLabel(
      selectedPeriod,
      selectedMonth,
      selectedFromMonth,
      selectedToMonth,
      currentMonthKey
    );

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
              Analyse de
              l&apos;activité
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              Rapports
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737A75]">
              Ventes, produits,
              caissiers et
              annulations en une
              seule vue.
            </p>
          </div>
        </header>

        {/* FILTRES PRINCIPAUX */}
        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
          <Link
            href="/admin/reports?period=today"
            className={
              selectedPeriod ===
              "today"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Aujourd&apos;hui
          </Link>

          <Link
            href="/admin/reports?period=week"
            className={
              selectedPeriod ===
              "week"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Semaine
          </Link>

          <Link
            href={`/admin/reports?period=month&month=${currentMonthKey}`}
            className={
              selectedPeriod ===
              "month"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Mois
          </Link>

          <Link
            href={`/admin/reports?period=range&from=${firstMonthKey}&to=${currentMonthKey}`}
            className={
              selectedPeriod ===
              "range"
                ? "min-h-11 flex-1 whitespace-nowrap rounded-xl bg-[#1E4D3A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                : "min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[#68706B] transition hover:bg-[#F5F4F0]"
            }
          >
            Période
          </Link>
        </nav>

        {/* CHOIX DU MOIS */}
        {selectedPeriod ===
          "month" && (
          <form
            action="/admin/reports"
            method="get"
            className="mb-4 rounded-[20px] border border-[#E3E0D8] bg-white p-4 shadow-sm"
          >
            <input
              type="hidden"
              name="period"
              value="month"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="month"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#7A817C]"
                >
                  Mois
                </label>

                <select
                  id="month"
                  name="month"
                  defaultValue={
                    selectedMonth
                  }
                  className="min-h-12 w-full rounded-xl border border-[#DDDAD2] bg-white px-4 text-sm font-semibold text-[#1F2924] outline-none transition focus:border-[#2E6A50]"
                >
                  {monthOptions.map(
                    (month) => (
                      <option
                        key={
                          month.value
                        }
                        value={
                          month.value
                        }
                      >
                        {
                          month.label
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <button
                type="submit"
                className="min-h-12 rounded-xl bg-[#1E4D3A] px-6 text-sm font-semibold text-white transition hover:bg-[#173D2F]"
              >
                Afficher
              </button>
            </div>
          </form>
        )}

        {/* CHOIX DE LA PÉRIODE */}
        {selectedPeriod ===
          "range" && (
          <form
            action="/admin/reports"
            method="get"
            className="mb-4 rounded-[20px] border border-[#E3E0D8] bg-white p-4 shadow-sm"
          >
            <input
              type="hidden"
              name="period"
              value="range"
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label
                  htmlFor="from"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#7A817C]"
                >
                  De
                </label>

                <select
                  id="from"
                  name="from"
                  defaultValue={
                    selectedFromMonth
                  }
                  className="min-h-12 w-full rounded-xl border border-[#DDDAD2] bg-white px-4 text-sm font-semibold text-[#1F2924] outline-none transition focus:border-[#2E6A50]"
                >
                  {monthOptions.map(
                    (month) => (
                      <option
                        key={
                          month.value
                        }
                        value={
                          month.value
                        }
                      >
                        {
                          month.label
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="to"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#7A817C]"
                >
                  À
                </label>

                <select
                  id="to"
                  name="to"
                  defaultValue={
                    selectedToMonth
                  }
                  className="min-h-12 w-full rounded-xl border border-[#DDDAD2] bg-white px-4 text-sm font-semibold text-[#1F2924] outline-none transition focus:border-[#2E6A50]"
                >
                  {monthOptions.map(
                    (month) => (
                      <option
                        key={
                          month.value
                        }
                        value={
                          month.value
                        }
                      >
                        {
                          month.label
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <button
                type="submit"
                className="min-h-12 rounded-xl bg-[#1E4D3A] px-6 text-sm font-semibold text-white transition hover:bg-[#173D2F]"
              >
                Afficher
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#343D38]">
              {periodLabel}
            </p>

            {exactRangeLabel && (
              <p className="mt-1 text-xs font-medium text-[#7A817C]">
                {exactRangeLabel}
              </p>
            )}
          </div>

          <p className="text-xs text-[#8A918C]">
            Journée commerciale :
            07h00 → 07h00
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-3 text-3xl font-black tracking-tight">
              {formatMoney(
                revenue
              )}{" "}
              <span className="text-base font-semibold text-white/70">
                MRU
              </span>
            </p>

            <p className="mt-4 text-xs text-white/60">
              {
                paidOrderCount
              }{" "}
              commande
              {paidOrderCount >
              1
                ? "s"
                : ""}{" "}
              encaissée
              {paidOrderCount >
              1
                ? "s"
                : ""}
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Ticket moyen
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {formatMoney(
                averageOrder
              )}{" "}
              <span className="text-base font-semibold text-[#737A75]">
                MRU
              </span>
            </p>

            <p className="mt-4 text-xs text-[#9A9F9B]">
              Par commande payée
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Produits vendus
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {
                totalSoldItems
              }
            </p>

            <p className="mt-4 text-xs text-[#9A9F9B]">
              Unités encaissées
            </p>
          </div>

          <div
            className={
              cancelledOrderCount >
                0 ||
              totalCancelledItems >
                0
                ? "rounded-[24px] border border-[#EDC7C0] bg-[#FFF7F5] p-5 shadow-sm"
                : "rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#737A75]">
                  Annulations
                </p>

                <p
                  className={
                    cancelledOrderCount >
                      0 ||
                    totalCancelledItems >
                      0
                      ? "mt-3 text-3xl font-black text-[#A74435]"
                      : "mt-3 text-3xl font-black text-[#1F2924]"
                  }
                >
                  {
                    cancelledOrderCount
                  }
                </p>
              </div>

              {cancelledOrderCount >
                0 && (
                <span className="rounded-full bg-[#FCE4DF] px-2.5 py-1 text-xs font-semibold text-[#A74435]">
                  {
                    cancellationRate
                  }
                  %
                </span>
              )}
            </div>

            <p className="mt-4 text-xs text-[#9A6A62]">
              {formatMoney(
                cancelledValue
              )}{" "}
              MRU de valeur annulée
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              Moyens de paiement
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Répartition du chiffre
              d&apos;affaires
            </p>

            <div className="mt-6 space-y-5">
              {paymentMethods.map(
                (method) => {
                  const amount =
                    paymentTotals[
                      method
                    ] || 0;

                  const percentage =
                    getPaymentPercentage(
                      amount
                    );

                  return (
                    <div
                      key={
                        method
                      }
                    >
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#343D38]">
                            {
                              method
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-[#9A9F9B]">
                            {
                              percentage
                            }
                            % du CA
                          </p>
                        </div>

                        <p className="text-sm font-bold text-[#1F2924]">
                          {formatMoney(
                            amount
                          )}{" "}
                          MRU
                        </p>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#EEF0EC]">
                        <div
                          className="h-full rounded-full bg-[#2E6A50]"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
              Par caissier
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Encaissements par
              utilisateur
            </p>

            {cashierRows.length ===
            0 ? (
              <div className="mt-6 rounded-2xl bg-[#F6F6F2] p-6 text-center">
                <p className="text-sm text-[#8A918C]">
                  Aucune vente sur
                  cette période.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {cashierRows.map(
                  (
                    cashier,
                    index
                  ) => {
                    const share =
                      maxCashierRevenue >
                      0
                        ? Math.round(
                            (cashier.revenue /
                              maxCashierRevenue) *
                              100
                          )
                        : 0;

                    const average =
                      cashier.orders >
                      0
                        ? Math.round(
                            cashier.revenue /
                              cashier.orders
                          )
                        : 0;

                    return (
                      <div
                        key={
                          cashier.id
                        }
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF5EF] text-sm font-black text-[#2E6A50]">
                              {
                                index +
                                1
                              }
                            </span>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#1F2924]">
                                {
                                  cashier.name
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-[#8A918C]">
                                {
                                  cashier.orders
                                }{" "}
                                commande
                                {cashier.orders >
                                1
                                  ? "s"
                                  : ""}{" "}
                                · Ticket{" "}
                                {formatMoney(
                                  average
                                )}{" "}
                                MRU
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 font-bold text-[#1F2924]">
                            {formatMoney(
                              cashier.revenue
                            )}{" "}
                            MRU
                          </p>
                        </div>

                        <div className="ml-12 mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0EC]">
                          <div
                            className="h-full rounded-full bg-[#2E6A50]"
                            style={{
                              width: `${share}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="border-b border-[#EEECE6] p-5 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                  Produits
                </h2>

                <p className="mt-1 text-sm text-[#737A75]">
                  Ce qui a été vendu
                  et annulé
                </p>
              </div>

              <div className="flex gap-2">
                <div className="rounded-xl bg-[#EDF5EF] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#66806E]">
                    Vendus
                  </p>

                  <p className="mt-0.5 text-lg font-black text-[#1E4D3A]">
                    {
                      totalSoldItems
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-[#FFF1EE] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A16A61]">
                    Annulés
                  </p>

                  <p className="mt-0.5 text-lg font-black text-[#A74435]">
                    {
                      totalCancelledItems
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {productRows.length ===
          0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-[#4E5651]">
                Aucun produit
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                Aucun mouvement de
                produit sur cette
                période.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEECE6]">
              {productRows.map(
                (product) => {
                  const totalActivity =
                    product.sold +
                    product.cancelled;

                  const cancellationPercentage =
                    totalActivity >
                    0
                      ? Math.round(
                          (product.cancelled /
                            totalActivity) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={
                        product.id
                      }
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center sm:px-6 sm:py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1F2924]">
                          {
                            product.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-[#8A918C]">
                          {
                            product.category
                          }
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:block sm:text-right">
                        <span className="text-xs text-[#8A918C] sm:hidden">
                          Vendus
                        </span>

                        <span className="font-bold text-[#1E4D3A]">
                          {
                            product.sold
                          }
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:block sm:text-right">
                        <span className="text-xs text-[#8A918C] sm:hidden">
                          Annulés
                        </span>

                        <div>
                          <span
                            className={
                              product.cancelled >
                              0
                                ? "font-bold text-[#A74435]"
                                : "font-bold text-[#8A918C]"
                            }
                          >
                            {
                              product.cancelled
                            }
                          </span>

                          {product.cancelled >
                            0 && (
                            <span className="ml-2 text-[10px] font-semibold text-[#B8786E]">
                              {
                                cancellationPercentage
                              }
                              %
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-[#A74435]">
              Contrôle
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              Annulations
            </h2>

            <p className="mt-1 text-sm text-[#737A75]">
              Identifiez rapidement
              où et pourquoi les
              annulations ont lieu.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#737A75]">
                Commandes
              </p>

              <p className="mt-2 text-2xl font-black text-[#A74435]">
                {
                  cancelledOrderCount
                }
              </p>

              <p className="mt-2 text-xs text-[#9A9F9B]">
                {
                  cancellationRate
                }
                % des décisions de
                commande
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#737A75]">
                Articles
              </p>

              <p className="mt-2 text-2xl font-black text-[#A74435]">
                {
                  totalCancelledItems
                }
              </p>

              <p className="mt-2 text-xs text-[#9A9F9B]">
                Unités annulées
              </p>
            </div>

            <div className="rounded-[22px] border border-[#EED3A8] bg-[#FFF9F0] p-5">
              <p className="text-sm text-[#8F6C43]">
                Avant cuisine
              </p>

              <p className="mt-2 text-2xl font-black text-[#9A5A18]">
                {
                  cancelledBeforeKitchen
                }
              </p>

              <p className="mt-2 text-xs text-[#9B7B57]">
                Avant préparation
              </p>
            </div>

            <div className="rounded-[22px] border border-[#EDC7C0] bg-[#FFF7F5] p-5">
              <p className="text-sm text-[#9A6A62]">
                Après cuisine
              </p>

              <p className="mt-2 text-2xl font-black text-[#A74435]">
                {
                  cancelledAfterKitchen
                }
              </p>

              <p className="mt-2 text-xs text-[#AD746A]">
                {
                  afterKitchenRate
                }
                % des unités annulées
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm lg:sticky lg:top-6">
              <h3 className="text-lg font-bold text-[#1F2924]">
                Principaux motifs
              </h3>

              <p className="mt-1 text-sm text-[#737A75]">
                Nombre
                d&apos;événements
              </p>

              {reasonRows.length ===
              0 ? (
                <div className="mt-5 rounded-2xl bg-[#F6F6F2] p-5 text-center">
                  <p className="text-sm text-[#8A918C]">
                    Aucune
                    annulation.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {reasonRows.map(
                    (
                      reason,
                      index
                    ) => (
                      <div
                        key={
                          reason.reason
                        }
                        className="flex items-center gap-3 rounded-2xl bg-[#F7F7F3] px-3 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-[#8A918C]">
                          {
                            index +
                            1
                          }
                        </span>

                        <span className="min-w-0 flex-1 text-sm font-medium text-[#4E5651]">
                          {
                            reason.reason
                          }
                        </span>

                        <span className="font-black text-[#A74435]">
                          {
                            reason.count
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </aside>

            <div className="overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
              <div className="border-b border-[#EEECE6] p-5">
                <h3 className="text-lg font-bold text-[#1F2924]">
                  Historique
                </h3>

                <p className="mt-1 text-sm text-[#737A75]">
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
                <div className="p-8 text-center">
                  <p className="font-semibold text-[#4E5651]">
                    Aucune annulation
                  </p>

                  <p className="mt-1 text-sm text-[#8A918C]">
                    Aucun événement
                    sur cette période.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EEECE6]">
                  {cancellationHistory.map(
                    (
                      cancellation
                    ) => (
                      <Link
                        key={
                          cancellation.key
                        }
                        href={`/admin/orders/${cancellation.orderId}`}
                        className="group block p-4 transition hover:bg-[#FAFAF7] sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-[#1F2924]">
                                {
                                  cancellation.label
                                }
                              </p>

                              <span
                                className={
                                  cancellation.type ===
                                  "order"
                                    ? "rounded-full bg-[#FCE4DF] px-2.5 py-1 text-[11px] font-semibold text-[#A74435]"
                                    : "rounded-full bg-[#FFF1EE] px-2.5 py-1 text-[11px] font-semibold text-[#B35A4C]"
                                }
                              >
                                {cancellation.type ===
                                "order"
                                  ? "Commande"
                                  : "Article"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-[#737A75]">
                              {cancellation.orderNumber
                                ? `#${cancellation.orderNumber} · `
                                : ""}
                              {
                                cancellation.location
                              }
                            </p>

                            <div className="mt-3 rounded-xl bg-[#F7F7F3] px-3 py-2">
                              <p className="text-xs text-[#8A918C]">
                                Motif
                              </p>

                              <p className="mt-0.5 text-sm font-semibold text-[#4E5651]">
                                {
                                  cancellation.reason
                                }
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {cancellation.quantity >
                                0 && (
                                <span className="rounded-full bg-[#F1F2EF] px-2.5 py-1 text-xs font-semibold text-[#68706B]">
                                  Qté{" "}
                                  {
                                    cancellation.quantity
                                  }
                                </span>
                              )}

                              {cancellation.beforeKitchen >
                                0 && (
                                <span className="rounded-full bg-[#FFF6E9] px-2.5 py-1 text-xs font-semibold text-[#9A5A18]">
                                  Avant cuisine{" "}
                                  {
                                    cancellation.beforeKitchen
                                  }
                                </span>
                              )}

                              {cancellation.afterKitchen >
                                0 && (
                                <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-xs font-semibold text-[#A74435]">
                                  Après cuisine{" "}
                                  {
                                    cancellation.afterKitchen
                                  }
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 sm:text-right">
                            <p className="text-sm font-semibold text-[#4E5651]">
                              {
                                cancellation.cashier
                              }
                            </p>

                            <p className="mt-1 text-xs text-[#9A9F9B]">
                              {formatDateTime(
                                cancellation.date
                              )}
                            </p>

                            <p className="mt-3 text-xs font-semibold text-[#2E6A50] transition group-hover:translate-x-0.5">
                              Voir →
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

        <section className="mt-6 overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EEECE6] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                Rapports de shifts
              </h2>

              <p className="mt-1 text-sm text-[#737A75]">
                Récapitulatifs
                générés à la clôture
              </p>
            </div>

            <Link
              href="/admin/shifts"
              className="text-sm font-semibold text-[#2E6A50]"
            >
              Voir tous les shifts →
            </Link>
          </div>

          {shiftRows.length ===
          0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-[#4E5651]">
                Aucun rapport
              </p>

              <p className="mt-1 text-sm text-[#8A918C]">
                Aucun shift clôturé
                sur cette période.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEECE6]">
              {shiftRows.map(
                (report) => {
                  const payload =
                    report.payload;

                  const paid =
                    Number(
                      payload.paidOrderCount ||
                        0
                    );

                  const cancelled =
                    Number(
                      payload.cancelledOrderCount ||
                        0
                    );

                  const activePayments =
                    paymentMethods.filter(
                      (method) =>
                        Number(
                          payload
                            .payments?.[
                            method
                          ] || 0
                        ) > 0
                    );

                  return (
                    <article
                      key={
                        report.id
                      }
                      className="p-5 md:p-6"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-[#1F2924]">
                              {payload
                                .cashier
                                ?.name ||
                                "Caissier"}
                            </h3>

                            <span className="rounded-full bg-[#EDF5EF] px-2.5 py-1 text-[11px] font-semibold text-[#2E6A50]">
                              Clôturé
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-[#737A75]">
                            {formatDateTime(
                              payload.startedAt
                            )}
                            {" → "}
                            {formatTime(
                              payload.endedAt
                            )}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#F1F2EF] px-2.5 py-1 text-xs font-semibold text-[#68706B]">
                              {paid} payée
                              {paid >
                              1
                                ? "s"
                                : ""}
                            </span>

                            {cancelled >
                              0 && (
                              <span className="rounded-full bg-[#FFF1EE] px-2.5 py-1 text-xs font-semibold text-[#A74435]">
                                {
                                  cancelled
                                }{" "}
                                annulée
                                {cancelled >
                                1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
                          </div>

                          {activePayments.length >
                            0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {activePayments.map(
                                (
                                  method
                                ) => (
                                  <div
                                    key={
                                      method
                                    }
                                    className="rounded-xl bg-[#F7F7F3] px-3 py-2"
                                  >
                                    <span className="text-xs text-[#7A817C]">
                                      {
                                        method
                                      }
                                    </span>

                                    <span className="ml-2 text-sm font-bold text-[#1F2924]">
                                      {formatMoney(
                                        Number(
                                          payload
                                            .payments?.[
                                            method
                                          ] ||
                                            0
                                        )
                                      )}{" "}
                                      MRU
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl bg-[#EDF5EF] px-5 py-4 lg:min-w-[180px] lg:text-right">
                          <p className="text-xs font-medium text-[#667D6D]">
                            CA du shift
                          </p>

                          <p className="mt-1 text-2xl font-black text-[#1E4D3A]">
                            {formatMoney(
                              Number(
                                payload.revenue ||
                                  0
                              )
                            )}
                          </p>

                          <p className="text-xs font-semibold text-[#6D8274]">
                            MRU
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}