import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const t =
    await getTranslations(
      "ApiMenu"
    );

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
      .from("menu_items")
      .select(
        "id, name, category, price"
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .eq(
        "active",
        true
      )
      .order(
        "category",
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
      "MENU GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.getMenuFailed"
          ),
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