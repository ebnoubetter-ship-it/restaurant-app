import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import bcrypt from "bcryptjs";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSession } from "@/lib/session";
import { getActiveRestaurant } from "@/lib/restaurant-access";

export async function POST(
  request: Request
) {
  const t =
    await getTranslations(
      "ApiAuthSetPin"
    );

  /*
   * ============================
   * RESTAURANT
   * ============================
   */
  const access =
    await getActiveRestaurant();

  if (!access.success) {
    return NextResponse.json(
      {
        error: access.error,
        restricted:
          access.restricted ||
          false,
      },
      {
        status: access.status,
      }
    );
  }

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    name?: unknown;
    pin?: unknown;
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidRequest"
          ),
      },
      {
        status: 400,
      }
    );
  }

  const cleanName =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const pin =
    typeof body.pin === "string"
      ? body.pin
      : "";

  if (
    !cleanName ||
    !/^\d{4}$/.test(pin)
  ) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidPin"
          ),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * UTILISATEUR DU RESTAURANT
   * ============================
   */
  const {
    data: user,
    error,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name,
      role,
      pin_defined,
      restaurant_id
    `)
    .eq(
      "restaurant_id",
      access.restaurant.id
    )
    .ilike(
      "name",
      cleanName
    )
    .maybeSingle();

  if (
    error ||
    !user
  ) {
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

  if (user.pin_defined) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.pinAlreadyExists"
          ),
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * HASH DU PIN
   * ============================
   */
  const pinHash =
    await bcrypt.hash(
      pin,
      10
    );

  /*
   * Protection contre deux créations
   * simultanées du PIN.
   */
  const {
    data: updatedUser,
    error: updateError,
  } = await supabaseAdmin
    .from("users")
    .update({
      pin_hash:
        pinHash,

      pin_defined:
        true,
    })
    .eq(
      "id",
      user.id
    )
    .eq(
      "restaurant_id",
      access.restaurant.id
    )
    .eq(
      "pin_defined",
      false
    )
    .select(`
      id,
      name,
      role,
      restaurant_id
    `)
    .maybeSingle();

  if (updateError) {
    console.error(
      "SET PIN ERROR:",
      updateError
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.createPinFailed"
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
            "errors.pinJustCreated"
          ),
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * SESSION MULTI-RESTAURANT
   * ============================
   */
  await createSession({
    id:
      updatedUser.id,

    name:
      updatedUser.name,

    role:
      updatedUser.role,

    restaurantId:
      updatedUser.restaurant_id,
  });

  return NextResponse.json({
    success: true,

    role:
      updatedUser.role,

    restaurant: {
      id:
        access.restaurant.id,

      name:
        access.restaurant.name,
    },
  });
}