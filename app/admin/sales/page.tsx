import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Period =
  | "today"
  | "week"
  | "month"
  | "range";

type MonthOption = {
  value: string;
  label: string;
};

const paymentMethods = [
  "Cash",
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
];

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
  } =
    parseMonthKey(value);

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

  /*
   * Garde-fou très large :
   * 100 ans maximum.
   */
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
      cursor.getUTCMonth() -
        1
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

function getBusinessDayRange() {
  const now =
    new Date();

  const start =
    new Date(now);

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
  const now =
    new Date();

  const businessNow =
    getBusinessDate(now);

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

function getMonthRange(
  monthKey: string,
  currentMonthKey: string
) {
  const {
    year,
    month,
  } =
    parseMonthKey(
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

  /*
   * Si le mois sélectionné
   * est le mois en cours,
   * on s'arrête maintenant.
   */
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

function getRangePeriod(
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
    start:
      from.start,

    end:
      to.end,
  };
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

export default async function AdminSalesPage({
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
    .select(
      "paid_at"
    )
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
      "ADMIN SALES FIRST SALE ERROR:",
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

  /*
   * Si l'utilisateur inverse
   * les deux mois, MAIDA les
   * remet automatiquement
   * dans le bon ordre.
   *
   * YYYY-MM est comparable
   * directement.
   */
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

  /*
   * ============================
   * VENTES DU RESTAURANT
   * ============================
   */
  let query =
    supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        payment_method,
        paid_at,
        cashier_id,
        order_type,
        table_id
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

  if (
    selectedPeriod ===
    "today"
  ) {
    const {
      start,
      end,
    } =
      getBusinessDayRange();

    query =
      query
        .gte(
          "paid_at",
          start.toISOString()
        )
        .lt(
          "paid_at",
          end.toISOString()
        );
  }

  if (
    selectedPeriod ===
    "week"
  ) {
    const {
      start,
      end,
    } =
      getWeekRange();

    query =
      query
        .gte(
          "paid_at",
          start.toISOString()
        )
        .lt(
          "paid_at",
          end.toISOString()
        );
  }

  if (
    selectedPeriod ===
    "month"
  ) {
    const {
      start,
      end,
    } =
      getMonthRange(
        selectedMonth,
        currentMonthKey
      );

    query =
      query
        .gte(
          "paid_at",
          start.toISOString()
        )
        .lt(
          "paid_at",
          end.toISOString()
        );
  }

  if (
    selectedPeriod ===
    "range"
  ) {
    const {
      start,
      end,
    } =
      getRangePeriod(
        selectedFromMonth,
        selectedToMonth,
        currentMonthKey
      );

    query =
      query
        .gte(
          "paid_at",
          start.toISOString()
        )
        .lt(
          "paid_at",
          end.toISOString()
        );
  }

  const {
    data: sales,
    error,
  } = await query;

  if (error) {
    console.error(
      "ADMIN SALES ERROR:",
      error
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
              Ventes indisponibles
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Impossible de
              récupérer les ventes
              pour le moment.
            </p>

            <a
              href="/admin/sales"
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

  const orders =
    sales || [];

  /*
   * ============================
   * TABLES + CAISSIERS
   * ============================
   */
  const tableIds = [
    ...new Set(
      orders
        .map(
          (order) =>
            order.table_id
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

  const cashierIds = [
    ...new Set(
      orders
        .map(
          (order) =>
            order.cashier_id
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

  const tablesMap =
    new Map<
      string,
      string
    >();

  const cashiersMap =
    new Map<
      string,
      string
    >();

  const [
    tablesResult,
    cashiersResult,
  ] = await Promise.all([
    tableIds.length > 0
      ? supabaseAdmin
          .from(
            "restaurant_tables"
          )
          .select(
            "id, name"
          )
          .eq(
            "restaurant_id",
            restaurantId
          )
          .in(
            "id",
            tableIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    cashierIds.length > 0
      ? supabaseAdmin
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
            cashierIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (
    tablesResult.error
  ) {
    console.error(
      "ADMIN SALES TABLES ERROR:",
      tablesResult.error
    );
  }

  if (
    cashiersResult.error
  ) {
    console.error(
      "ADMIN SALES CASHIERS ERROR:",
      cashiersResult.error
    );
  }

  for (
    const table of
    tablesResult.data || []
  ) {
    tablesMap.set(
      table.id,
      table.name
    );
  }

  for (
    const cashier of
    cashiersResult.data || []
  ) {
    cashiersMap.set(
      cashier.id,
      cashier.name
    );
  }

  /*
   * ============================
   * STATISTIQUES
   * ============================
   */
  const totalSales =
    orders.reduce(
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

  const orderCount =
    orders.length;

  const averageOrder =
    orderCount > 0
      ? Math.round(
          totalSales /
            orderCount
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
    const order of orders
  ) {
    if (
      !order.payment_method
    ) {
      continue;
    }

    paymentTotals[
      order.payment_method
    ] =
      (
        paymentTotals[
          order.payment_method
        ] || 0
      ) +
      Number(
        order.total || 0
      );
  }

  const getPaymentPercentage = (
    amount: number
  ) => {
    if (
      totalSales <= 0
    ) {
      return 0;
    }

    return Math.round(
      (
        amount /
        totalSales
      ) * 100
    );
  };

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
              Encaissements
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              Ventes
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              Consultez chaque vente
              et son mode de paiement.
            </p>
          </div>
        </header>

        {/* FILTRES PRINCIPAUX */}
        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-[#E3E0D8] bg-white p-1 shadow-sm">
          <Link
            href="/admin/sales?period=today"
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
            href="/admin/sales?period=week"
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
            href={`/admin/sales?period=month&month=${currentMonthKey}`}
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
            href={`/admin/sales?period=range&from=${firstMonthKey}&to=${currentMonthKey}`}
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
            action="/admin/sales"
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
            action="/admin/sales"
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

        {/* PÉRIODE ACTIVE */}
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

        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              Chiffre
              d&apos;affaires
            </p>

            <p className="mt-3 text-3xl font-black tracking-tight">
              {formatMoney(
                totalSales
              )}{" "}
              <span className="text-base font-semibold text-white/70">
                MRU
              </span>
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              Commandes
            </p>

            <p className="mt-3 text-3xl font-black text-[#1F2924]">
              {orderCount}
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Ventes encaissées
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

            <p className="mt-3 text-xs text-[#9A9F9B]">
              Moyenne par vente
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* PAIEMENTS */}
          <section className="h-fit rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-[#1F2924]">
              Paiements
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              Répartition du CA
            </p>

            <div className="mt-5 space-y-5">
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
                    <div key={method}>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#343D38]">
                            {method}
                          </p>

                          <p className="mt-0.5 text-xs text-[#9A9F9B]">
                            {
                              percentage
                            }
                            %
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

          {/* DÉTAIL DES VENTES */}
          <section className="overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="border-b border-[#EEECE6] p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                    Détail des ventes
                  </h2>

                  <p className="mt-1 text-sm text-[#7A817C]">
                    {orderCount}{" "}
                    commande
                    {orderCount >
                    1
                      ? "s"
                      : ""}
                  </p>
                </div>

                {orderCount >
                  0 && (
                  <span className="hidden rounded-full bg-[#EDF5EF] px-3 py-1.5 text-xs font-semibold text-[#2E6A50] sm:inline-flex">
                    {periodLabel}
                  </span>
                )}
              </div>
            </div>

            {orders.length ===
            0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                  —
                </div>

                <h3 className="mt-4 font-bold text-[#343D38]">
                  Aucune vente
                </h3>

                <p className="mt-1 max-w-xs text-sm leading-6 text-[#8A918C]">
                  Aucun encaissement
                  n&apos;a été
                  enregistré sur
                  cette période.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEECE6]">
                {orders.map(
                  (order) => {
                    const orderLabel =
                      order.order_type ===
                      "takeaway"
                        ? "À emporter"
                        : order.table_id
                          ? tablesMap.get(
                              order.table_id
                            ) ||
                            "Table"
                          : "Table";

                    const cashierName =
                      order.cashier_id
                        ? cashiersMap.get(
                            order.cashier_id
                          ) ||
                          "—"
                        : "—";

                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className="group block p-4 transition hover:bg-[#FAFAF7] active:bg-[#F5F5F1] sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-[#1F2924] sm:text-lg">
                                {
                                  orderLabel
                                }
                              </h3>

                              {order.order_number && (
                                <span className="text-xs font-semibold text-[#9A9F9B]">
                                  #
                                  {
                                    order.order_number
                                  }
                                </span>
                              )}

                              {order.order_type ===
                                "takeaway" && (
                                <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-[11px] font-semibold text-[#7D6755]">
                                  À emporter
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#F3F4F1] px-2.5 py-1 text-xs font-semibold text-[#5F6862]">
                                {order.payment_method ||
                                  "Paiement"}
                              </span>

                              <span className="text-xs text-[#7A817C]">
                                Caissier :{" "}
                                <span className="font-semibold text-[#565E59]">
                                  {
                                    cashierName
                                  }
                                </span>
                              </span>
                            </div>

                            {order.paid_at && (
                              <p className="mt-2 text-xs text-[#9A9F9B]">
                                {new Date(
                                  order.paid_at
                                ).toLocaleString(
                                  "fr-FR",
                                  {
                                    timeZone:
                                      "Africa/Nouakchott",
                                    day:
                                      "2-digit",
                                    month:
                                      "2-digit",
                                    year:
                                      "numeric",
                                    hour:
                                      "2-digit",
                                    minute:
                                      "2-digit",
                                  }
                                )}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-lg font-black text-[#1F2924] sm:text-xl">
                              {formatMoney(
                                Number(
                                  order.total ||
                                    0
                                )
                              )}
                            </p>

                            <p className="text-[10px] font-semibold text-[#8A918C]">
                              MRU
                            </p>

                            <p className="mt-3 text-sm font-semibold text-[#2E6A50] transition group-hover:translate-x-0.5">
                              Voir →
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            MAIDA · Administration
          </p>
        </footer>
      </div>
    </main>
  );
}