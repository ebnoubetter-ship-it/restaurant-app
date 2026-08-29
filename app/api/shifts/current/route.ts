import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const t =
    await getTranslations(
      "ApiShiftCurrent"
    );

  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const session =
    access.session;

  const restaurantId =
    access.restaurant.id;

  /*
   * SHIFT ACTUEL
   */
  const {
    data: shift,
    error,
  } = await supabaseAdmin
    .from("shifts")
    .select(`
      id,
      started_at,
      ended_at,
      status
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
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
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.getShiftFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (!shift) {
    return NextResponse.json({
      shift: null,
      summary: null,
    });
  }

  /*
   * COMMANDES PAYÉES
   * DU SHIFT
   */
  const {
    data: paidOrders,
    error: paidOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      total,
      payment_method
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "shift_id",
      shift.id
    )
    .eq(
      "status",
      "paid"
    );

  if (paidOrdersError) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.getShiftSalesFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  /*
   * COMMANDES ANNULÉES
   *
   * Certaines n'ont pas de shift_id,
   * donc filtre caissier + période
   * + restaurant.
   */
  const {
    data: cancelledOrders,
    error: cancelledOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
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
    );

  if (cancelledOrdersError) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.getCancelledOrdersFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  /*
   * COMMANDES ENCORE OUVERTES
   */
  const {
    data: openOrders,
    error: openOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      order_type,
      restaurant_tables (
        name
      )
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
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
          t(
            "errors.checkOpenOrdersFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  const summary = {
    orderCount:
      paidOrders?.length ||
      0,

    paidOrderCount:
      paidOrders?.length ||
      0,

    cancelledOrderCount:
      cancelledOrders?.length ||
      0,

    openOrderCount:
      openOrders?.length ||
      0,

    total: 0,

    payments: {
      Cash: 0,
      Bankily: 0,
      Masrivi: 0,
      Sedad: 0,
      "BCI PAY": 0,
    } as Record<
      string,
      number
    >,

    openOrders:
      (
        openOrders || []
      ).map((order) => {
        const table =
          Array.isArray(
            order.restaurant_tables
          )
            ? order
                .restaurant_tables[0]
            : order.restaurant_tables;

        return {
          id:
            order.id,

          orderNumber:
            order.order_number,

          label:
            order.order_type ===
            "takeaway"
              ? t(
                  "order.takeaway"
                )
              : table?.name ||
                t(
                  "order.table"
                ),
        };
      }),
  };

  for (
    const order of
    paidOrders || []
  ) {
    const amount =
      Number(
        order.total || 0
      );

    summary.total +=
      amount;

    if (
      order.payment_method
    ) {
      summary.payments[
        order.payment_method
      ] =
        (
          summary.payments[
            order.payment_method
          ] || 0
        ) + amount;
    }
  }

  return NextResponse.json({
    shift,
    summary,
  });
}