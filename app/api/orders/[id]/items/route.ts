import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function GET(
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

  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      quantity,
      unit_price,
      menu_items (
        id,
        name,
        category
      )
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Impossible de récupérer la commande." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

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
  const { menuItemId } = await request.json();

  const { data: menuItem, error: menuError } =
    await supabaseAdmin
      .from("menu_items")
      .select("id, price")
      .eq("id", menuItemId)
      .eq("active", true)
      .single();

  if (menuError || !menuItem) {
    return NextResponse.json(
      { error: "Produit introuvable." },
      { status: 404 }
    );
  }

  const { data: existingItem } = await supabaseAdmin
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (existingItem) {
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity: existingItem.quantity + 1,
      })
      .eq("id", existingItem.id);

    if (error) {
      return NextResponse.json(
        { error: "Impossible de modifier la quantité." },
        { status: 500 }
      );
    }
  } else {
    const { error } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: orderId,
        menu_item_id: menuItemId,
        quantity: 1,
        unit_price: menuItem.price,
      });

    if (error) {
      return NextResponse.json(
        { error: "Impossible d'ajouter le produit." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
  });
}

export async function PATCH(
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
  const { itemId, action } = await request.json();

  const { data: item, error } = await supabaseAdmin
    .from("order_items")
    .select("id, quantity, order_id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .single();

  if (error || !item) {
    return NextResponse.json(
      { error: "Élément introuvable." },
      { status: 404 }
    );
  }

  if (action === "increase") {
    await supabaseAdmin
      .from("order_items")
      .update({
        quantity: item.quantity + 1,
      })
      .eq("id", itemId);
  }

  if (action === "decrease") {
    if (item.quantity <= 1) {
      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("id", itemId);
    } else {
      await supabaseAdmin
        .from("order_items")
        .update({
          quantity: item.quantity - 1,
        })
        .eq("id", itemId);
    }
  }

  if (action === "delete") {
    await supabaseAdmin
      .from("order_items")
      .delete()
      .eq("id", itemId);
  }

  return NextResponse.json({
    success: true,
  });
}