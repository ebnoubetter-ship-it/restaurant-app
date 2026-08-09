import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { id: orderId } = await context.params;
  const { paymentMethod } = await request.json();

  const allowedMethods = [
    "Bankily",
    "Masrivi",
    "Sedad",
    "BCI PAY",
    "Cash",
  ];

  if (!allowedMethods.includes(paymentMethod)) {
    return NextResponse.json(
      { error: "Mode de paiement invalide." },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("orders")
      .select("id, table_id, status")
      .eq("id", orderId)
      .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404 }
    );
  }

  if (order.status !== "open") {
    return NextResponse.json(
      { error: "Cette commande est déjà clôturée." },
      { status: 400 }
    );
  }

  const { data: items, error: itemsError } =
    await supabaseAdmin
      .from("order_items")
      .select("quantity, unit_price")
      .eq("order_id", orderId);

  if (itemsError) {
    return NextResponse.json(
      { error: "Impossible de calculer le total." },
      { status: 500 }
    );
  }

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity) *
        Number(item.unit_price),
    0
  );

  if (total <= 0) {
    return NextResponse.json(
      { error: "La commande est vide." },
      { status: 400 }
    );
  }

  const { error: paymentError } =
    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        total,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

  if (paymentError) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le paiement." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("restaurant_tables")
    .update({
      status: "available",
    })
    .eq("id", order.table_id);

  return NextResponse.json({
    success: true,
    total,
  });
}