import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  const t =
    await getTranslations(
      "ApiShiftOpen"
    );

  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const session =
    access.session;

  const restaurantId =
    access.restaurant.id;

  /*
   * Vérifier qu'aucun shift
   * n'est déjà ouvert pour ce
   * caissier dans CE restaurant.
   */
  const {
    data: existingShift,
    error: existingShiftError,
  } = await supabaseAdmin
    .from("shifts")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "cashier_id",
      session.id
    )
    .eq(
      "status",
      "open"
    )
    .limit(1)
    .maybeSingle();

  if (existingShiftError) {
    console.error(
      "OPEN SHIFT CHECK ERROR:",
      existingShiftError
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.checkCurrentShiftFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (existingShift) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.shiftAlreadyOpen"
          ),
      },
      {
        status: 409,
      }
    );
  }

  /*
   * restaurant_id est maintenant
   * explicitement enregistré.
   */
  const {
    data: shift,
    error,
  } = await supabaseAdmin
    .from("shifts")
    .insert({
      restaurant_id:
        restaurantId,

      cashier_id:
        session.id,

      status:
        "open",
    })
    .select(`
      id,
      started_at,
      status,
      restaurant_id
    `)
    .single();

  if (error) {
    console.error(
      "OPEN SHIFT ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.openShiftFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    shift,
  });
}