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
      "ApiAuthLogin"
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
            "errors.invalidCredentials"
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
   * Le même prénom peut exister :
   *
   * Appetizer → Ahmed
   * Restaurant B → Ahmed
   *
   * car restaurant_id fait partie
   * obligatoirement de la recherche.
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
      pin_hash,
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
    !user ||
    !user.pin_defined ||
    !user.pin_hash
  ) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.loginFailed"
          ),
      },
      {
        status: 401,
      }
    );
  }

  /*
   * ============================
   * PIN
   * ============================
   */
  const validPin =
    await bcrypt.compare(
      pin,
      user.pin_hash
    );

  if (!validPin) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.incorrectPin"
          ),
      },
      {
        status: 401,
      }
    );
  }

  /*
   * ============================
   * SESSION
   * ============================
   *
   * restaurantId est maintenant
   * signé dans le JWT.
   *
   * Le navigateur ne peut donc pas
   * simplement choisir un autre
   * restaurantId.
   */
  await createSession({
    id:
      user.id,

    name:
      user.name,

    role:
      user.role,

    restaurantId:
      user.restaurant_id,
  });

  return NextResponse.json({
    success: true,

    role:
      user.role,

    restaurant: {
      id:
        access.restaurant.id,

      name:
        access.restaurant.name,
    },
  });
}