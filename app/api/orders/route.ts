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

  const { tableId } = await request.json();

  if (!tableId) {
    return NextResponse.json(
      { error: "Table requise." },
      { status: 400 }
    );
  }

  const { data: existingOrder } = await supabaseAdmin
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

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      table_id: tableId,
      cashier_id: session.id,
      status: "open",
      total: 0,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible de créer la commande." },
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
