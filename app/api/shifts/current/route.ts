import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { data: shift, error } =
    await supabaseAdmin
      .from("shifts")
      .select(
        "id, started_at, ended_at, status"
      )
      .eq("cashier_id", session.id)
      .eq("status", "open")
      .order("started_at", {
        ascending: false,
      })
      .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer le shift.",
      },
      { status: 500 }
    );
  }

  if (!shift) {
    return NextResponse.json({
      shift: null,
      summary: null,
    });
  }

  /*
   * COMMANDES PAYÉES DU SHIFT
   */
  const {
    data: paidOrders,
    error: paidOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select(
      "total, payment_method"
    )
    .eq("shift_id", shift.id)
    .eq("status", "paid");

  if (paidOrdersError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les ventes du shift.",
      },
      { status: 500 }
    );
  }

  /*
   * COMMANDES ANNULÉES
   *
   * Elles n'ont pas forcément de shift_id,
   * donc on utilise le caissier et la période
   * du shift.
   */
  const {
    data: cancelledOrders,
    error: cancelledOrdersError,
  } = await supabaseAdmin
    .from("orders")
    .select("id")
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
          "Impossible de récupérer les commandes annulées.",
      },
      { status: 500 }
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

  const summary = {
    /*
     * On garde orderCount pour ne rien casser
     * dans les écrans existants.
     * Il correspond aux commandes payées.
     */
    orderCount:
      paidOrders?.length || 0,

    paidOrderCount:
      paidOrders?.length || 0,

    cancelledOrderCount:
      cancelledOrders?.length || 0,

    openOrderCount:
      openOrders?.length || 0,

    total: 0,

    payments: {
      Cash: 0,
      Bankily: 0,
      Masrivi: 0,
      Sedad: 0,
      "BCI PAY": 0,
    } as Record<string, number>,

    openOrders:
      (openOrders || []).map(
        (order) => {
          const table =
            Array.isArray(
              order.restaurant_tables
            )
              ? order
                  .restaurant_tables[0]
              : order.restaurant_tables;

          return {
            id: order.id,

            orderNumber:
              order.order_number,

            label:
              order.order_type ===
              "takeaway"
                ? "À emporter"
                : table?.name ||
                  "Table",
          };
        }
      ),
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
        (summary.payments[
          order.payment_method
        ] || 0) +
        amount;
    }
  }

  return NextResponse.json({
    shift,
    summary,
  });
}