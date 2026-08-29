import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getLocale,
  getTranslations,
} from "next-intl/server";

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
  value: string,
  locale: string
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

  const formatted =
    new Intl.DateTimeFormat(
      getNumberLocale(locale),
      {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
        numberingSystem: "latn",
      }
    ).format(date);

  return locale === "ar"
    ? formatted
    : capitalizeFirst(
        formatted
      );
}

function formatDateLabel(
  date: Date,
  locale: string
) {
  return new Intl.DateTimeFormat(
    getNumberLocale(locale),
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
      numberingSystem: "latn",
    }
  ).format(date);
}

function formatPaidAt(
  value: string,
  locale: string
) {
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

function buildMonthOptions(
  firstMonthKey: string,
  currentMonthKey: string,
  locale: string
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
          value,
          locale
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
          currentMonthKey,
          locale
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
  selectedToMonth: string,
  locale: string,
  t: (
    key: string
  ) => string
) {
  if (
    period === "week"
  ) {
    return t(
      "periodLabels.week"
    );
  }

  if (
    period === "month"
  ) {
    return formatMonthLabel(
      selectedMonth,
      locale
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
        selectedFromMonth,
        locale
      );
    }

    return `${formatMonthLabel(
      selectedFromMonth,
      locale
    )} ${
      locale === "ar"
        ? "←"
        : "→"
    } ${formatMonthLabel(
      selectedToMonth,
      locale
    )}`;
  }

  return t(
    "periodLabels.today"
  );
}

function getExactRangeLabel(
  period: Period,
  selectedMonth: string,
  selectedFromMonth: string,
  selectedToMonth: string,
  currentMonthKey: string,
  locale: string,
  t: (
    key: string,
    values?: Record<
      string,
      string
    >
  ) => string
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
    return t(
      "exactRange.untilToday",
      {
        start:
          formatDateLabel(
            startRange.start,
            locale
          ),
      }
    );
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

  return t(
    "exactRange.between",
    {
      start:
        formatDateLabel(
          startRange.start,
          locale
        ),

      end:
        formatDateLabel(
          lastDay,
          locale
        ),
    }
  );
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
  const t =
    await getTranslations(
      "AdminSales"
    );

  const locale =
    await getLocale();

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
      currentMonthKey,
      locale
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
                {t(
                  "administration"
                )}
              </p>
            </div>
          </header>

          <div className="mt-10 rounded-[26px] border border-[#E8E5DE] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EE] text-lg font-bold text-[#B24D3E]">
              !
            </div>

            <h1 className="mt-4 text-xl font-bold text-[#1F2924]">
              {t(
                "error.title"
              )}
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              {t(
                "error.description"
              )}
            </p>

            <a
              href="/admin/sales"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white"
            >
              {t(
                "actions.retry"
              )}
            </a>

            <div>
              <Link
                href="/admin"
                className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#68706B]"
              >
                {t(
                  "actions.backAdmin"
                )}
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

  const getPaymentLabel = (
    method: string
  ) => {
    if (
      method === "Cash"
    ) {
      return t(
        "payments.cash"
      );
    }

    return method;
  };

  const periodLabel =
    getPeriodLabel(
      selectedPeriod,
      selectedMonth,
      selectedFromMonth,
      selectedToMonth,
      locale,
      t
    );

  const exactRangeLabel =
    getExactRangeLabel(
      selectedPeriod,
      selectedMonth,
      selectedFromMonth,
      selectedToMonth,
      currentMonthKey,
      locale,
      t
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
                {t(
                  "administration"
                )}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-[#567362]"
            >
              {t(
                "actions.backAdmin"
              )}
            </Link>

            <p className="mt-3 text-sm font-semibold text-[#2E6A50]">
              {t(
                "paymentsTitle"
              )}
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              {t(
                "title"
              )}
            </h1>

            <p className="mt-2 text-sm text-[#737A75]">
              {t(
                "description"
              )}
            </p>
          </div>
        </header>

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
            {t(
              "filters.today"
            )}
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
            {t(
              "filters.week"
            )}
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
            {t(
              "filters.month"
            )}
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
            {t(
              "filters.range"
            )}
          </Link>
        </nav>

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
                  {t(
                    "filters.month"
                  )}
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
                {t(
                  "actions.show"
                )}
              </button>
            </div>
          </form>
        )}

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
                  {t(
                    "filters.from"
                  )}
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
                  {t(
                    "filters.to"
                  )}
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
                {t(
                  "actions.show"
                )}
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
                {
                  exactRangeLabel
                }
              </p>
            )}
          </div>

          <p
            className="text-xs text-[#8A918C]"
            dir={
              locale === "ar"
                ? "rtl"
                : "ltr"
            }
          >
            {t(
              "businessDay"
            )}
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] bg-[#1E4D3A] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/70">
              {t(
                "stats.revenue"
              )}
            </p>

            <p
              className="mt-3 text-3xl font-black tracking-tight"
              dir="ltr"
            >
              {formatMoney(
                totalSales,
                locale
              )}{" "}
              <span className="text-base font-semibold text-white/70">
                MRU
              </span>
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              {t(
                "stats.orders"
              )}
            </p>

            <p
              className="mt-3 text-3xl font-black text-[#1F2924]"
              dir="ltr"
            >
              {orderCount}
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              {t(
                "stats.paidSales"
              )}
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#737A75]">
              {t(
                "stats.averageTicket"
              )}
            </p>

            <p
              className="mt-3 text-3xl font-black text-[#1F2924]"
              dir="ltr"
            >
              {formatMoney(
                averageOrder,
                locale
              )}{" "}
              <span className="text-base font-semibold text-[#737A75]">
                MRU
              </span>
            </p>

            <p className="mt-3 text-xs text-[#9A9F9B]">
              {t(
                "stats.averageSale"
              )}
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="h-fit rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-[#1F2924]">
              {t(
                "paymentSection.title"
              )}
            </h2>

            <p className="mt-1 text-sm text-[#7A817C]">
              {t(
                "paymentSection.description"
              )}
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
                            {getPaymentLabel(
                              method
                            )}
                          </p>

                          <p
                            className="mt-0.5 text-xs text-[#9A9F9B]"
                            dir="ltr"
                          >
                            {
                              percentage
                            }
                            %
                          </p>
                        </div>

                        <p
                          className="text-sm font-bold text-[#1F2924]"
                          dir="ltr"
                        >
                          {formatMoney(
                            amount,
                            locale
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

          <section className="overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="border-b border-[#EEECE6] p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#1F2924]">
                    {t(
                      "salesDetails.title"
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-[#7A817C]">
                    <span dir="ltr">
                      {
                        orderCount
                      }
                    </span>{" "}
                    {orderCount === 1
                      ? t(
                          "salesDetails.order"
                        )
                      : t(
                          "salesDetails.orders"
                        )}
                  </p>
                </div>

                {orderCount >
                  0 && (
                  <span className="hidden rounded-full bg-[#EDF5EF] px-3 py-1.5 text-xs font-semibold text-[#2E6A50] sm:inline-flex">
                    {
                      periodLabel
                    }
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
                  {t(
                    "empty.title"
                  )}
                </h3>

                <p className="mt-1 max-w-xs text-sm leading-6 text-[#8A918C]">
                  {t(
                    "empty.description"
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEECE6]">
                {orders.map(
                  (order) => {
                    const orderLabel =
                      order.order_type ===
                      "takeaway"
                        ? t(
                            "order.takeaway"
                          )
                        : order.table_id
                          ? tablesMap.get(
                              order.table_id
                            ) ||
                            t(
                              "order.table"
                            )
                          : t(
                              "order.table"
                            );

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
                                <span
                                  className="text-xs font-semibold text-[#9A9F9B]"
                                  dir="ltr"
                                >
                                  #
                                  {
                                    order.order_number
                                  }
                                </span>
                              )}

                              {order.order_type ===
                                "takeaway" && (
                                <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-[11px] font-semibold text-[#7D6755]">
                                  {t(
                                    "order.takeaway"
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#F3F4F1] px-2.5 py-1 text-xs font-semibold text-[#5F6862]">
                                {order.payment_method
                                  ? getPaymentLabel(
                                      order.payment_method
                                    )
                                  : t(
                                      "order.payment"
                                    )}
                              </span>

                              <span className="text-xs text-[#7A817C]">
                                {t(
                                  "order.cashier"
                                )}
                                :{" "}
                                <span className="font-semibold text-[#565E59]">
                                  {
                                    cashierName
                                  }
                                </span>
                              </span>
                            </div>

                            {order.paid_at && (
                              <p
                                className="mt-2 text-xs text-[#9A9F9B]"
                                dir="ltr"
                              >
                                {formatPaidAt(
                                  order.paid_at,
                                  locale
                                )}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-end">
                            <p
                              className="text-lg font-black text-[#1F2924] sm:text-xl"
                              dir="ltr"
                            >
                              {formatMoney(
                                Number(
                                  order.total ||
                                    0
                                ),
                                locale
                              )}
                            </p>

                            <p
                              className="text-[10px] font-semibold text-[#8A918C]"
                              dir="ltr"
                            >
                              MRU
                            </p>

                            <p className="mt-3 text-sm font-semibold text-[#2E6A50]">
                              {t(
                                "actions.view"
                              )}
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
            {t(
              "footer"
            )}
          </p>
        </footer>
      </div>
    </main>
  );
}