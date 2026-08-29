import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const t =
    await getTranslations(
      "ApiUserResetPin"
    );

  /*
   * ============================
   * ADMIN DU RESTAURANT
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "admin",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  const { id } =
    await context.params;

  if (!id) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidUser"
          ),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * UTILISATEUR
   * ============================
   *
   * L'admin ne peut cibler qu'un
   * utilisateur de SON restaurant.
   */
  const {
    data: user,
    error: userError,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name
    `)
    .eq(
      "id",
      id
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (userError) {
    console.error(
      "RESET PIN USER LOOKUP ERROR:",
      userError
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.checkUserFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (!user) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.userNotFound"
          ),
      },
      {
        status: 404,
      }
    );
  }

  /*
   * ============================
   * RESET PIN
   * ============================
   */
  const {
    data: updatedUser,
    error,
  } = await supabaseAdmin
    .from("users")
    .update({
      pin_hash:
        null,

      pin_defined:
        false,
    })
    .eq(
      "id",
      id
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .select(`
      id,
      name,
      pin_defined
    `)
    .maybeSingle();

  if (error) {
    console.error(
      "RESET PIN ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.resetPinFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (!updatedUser) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.userNotFound"
          ),
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,

    user: {
      id:
        updatedUser.id,

      name:
        updatedUser.name,

      pin_defined:
        updatedUser.pin_defined,
    },
  });
}