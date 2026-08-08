import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("tableId");

  if (!tableId) {
    return NextResponse.json(
      { error: "Table requise." },
      { status: 400 }
    );
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "open")
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json(
      { error: "Aucune commande ouverte pour cette table." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    orderId: order.id,
  });
}