import {
  notFound,
  redirect,
} from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

import OrderClient from "./OrderClient";

export default async function OrderPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
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
    "cashier"
  ) {
    redirect("/unauthorized");
  }

  const restaurantId =
    access.restaurant.id;

  const { id } =
    await params;

  const {
    data: order,
    error,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      order_type,
      restaurant_tables (
        name
      )
    `)
    .eq(
      "id",
      id
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "restaurant_tables.restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (
    error ||
    !order
  ) {
    notFound();
  }

  const table =
    Array.isArray(
      order.restaurant_tables
    )
      ? order.restaurant_tables[0]
      : order.restaurant_tables;

  const orderLabel =
    order.order_type ===
    "takeaway"
      ? "À emporter"
      : table?.name ||
        "Table";

  return (
    <OrderClient
      orderId={
        order.id
      }
      orderLabel={
        orderLabel
      }
      orderNumber={
        order.order_number
          ? Number(
              order.order_number
            )
          : null
      }
    />
  );
}