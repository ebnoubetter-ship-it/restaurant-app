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

  const {
    data: orders,
    error: ordersError,
  } = await supabaseAdmin
    .from("orders")
    .select("total, payment_method")
    .eq("shift_id", shift.id)
    .eq("status", "paid");

  if (ordersError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les ventes du shift.",
      },
      { status: 500 }
    );
  }

  const summary = {
    orderCount: orders.length,
    total: 0,
    payments: {
      Cash: 0,
      Bankily: 0,
      Masrivi: 0,
      Sedad: 0,
      "BCI PAY": 0,
    } as Record<string, number>,
  };

  for (const order of orders) {
    const amount = Number(
      order.total || 0
    );

    summary.total += amount;

    if (order.payment_method) {
      summary.payments[
        order.payment_method
      ] =
        (summary.payments[
          order.payment_method
        ] || 0) + amount;
    }
  }

  return NextResponse.json({
    shift,
    summary,
  });
}