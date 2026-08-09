import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const body = await request.json();

  const tableId = body.tableId || null;
  const orderType =
    body.orderType === "takeaway"
      ? "takeaway"
      : "dine_in";

  // COMMANDE SUR PLACE
  if (orderType === "dine_in") {
    if (!tableId) {
      return NextResponse.json(
        { error: "Table requise." },
        { status: 400 }
      );
    }

    const { data: existingOrder } =
      await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("table_id", tableId)
        .eq("status", "open")
        .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({
        orderId: existingOrder.id,
      });
    }

    const { data: order, error } =
      await supabaseAdmin
        .from("orders")
        .insert({
          table_id: tableId,
          cashier_id: session.id,
          status: "open",
          total: 0,
          order_type: "dine_in",
        })
        .select("id")
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            "Impossible de créer la commande.",
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("restaurant_tables")
      .update({
        status: "occupied",
      })
      .eq("id", tableId);

    return NextResponse.json({
      orderId: order.id,
    });
  }

  // COMMANDE À EMPORTER
  const { data: takeawayOrder, error } =
    await supabaseAdmin
      .from("orders")
      .insert({
        table_id: null,
        cashier_id: session.id,
        status: "open",
        total: 0,
        order_type: "takeaway",
      })
      .select("id")
      .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Impossible de créer la commande à emporter.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    orderId: takeawayOrder.id,
  });
}