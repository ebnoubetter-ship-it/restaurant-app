import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  const { data, error } =
    await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .select(
        "id, code, name, zone, status"
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .order(
        "zone",
        {
          ascending: true,
        }
      )
      .order(
        "name",
        {
          ascending: true,
        }
      );

  if (error) {
    console.error(
      "TABLES GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les tables.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(
    data || []
  );
}