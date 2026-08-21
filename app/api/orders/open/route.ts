import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  /*
   * ============================
   * ACCÈS RESTAURANT + CAISSIER
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  /*
   * ============================
   * TABLE
   * ============================
   */
  const { searchParams } =
    new URL(request.url);

  const tableId =
    searchParams
      .get("tableId")
      ?.trim() || "";

  if (!tableId) {
    return NextResponse.json(
      {
        error: "Table requise.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * COMMANDE OUVERTE
   * ============================
   *
   * On recherche uniquement dans
   * le restaurant connecté.
   */
  const {
    data: order,
    error,
  } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "table_id",
      tableId
    )
    .eq(
      "status",
      "open"
    )
    .eq(
      "order_type",
      "dine_in"
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "OPEN ORDER LOOKUP ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de rechercher la commande.",
      },
      {
        status: 500,
      }
    );
  }

  if (!order) {
    return NextResponse.json(
      {
        error:
          "Aucune commande ouverte pour cette table.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    orderId: order.id,
  });
}