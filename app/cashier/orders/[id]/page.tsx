import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OrderClient from "./OrderClient";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      restaurant_tables (
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    notFound();
  }

  const table = Array.isArray(
    order.restaurant_tables
  )
    ? order.restaurant_tables[0]
    : order.restaurant_tables;

  return (
    <OrderClient
      orderId={order.id}
      tableName={table?.name || "Table"}
    />
  );
}