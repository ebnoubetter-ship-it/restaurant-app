import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getActiveRestaurant } from "@/lib/restaurant-access";

export async function POST(
  request: Request
) {
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
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Requête invalide.",
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

  if (!cleanName) {
    return NextResponse.json(
      {
        error:
          "Nom requis.",
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
   * IMPORTANT :
   * on cherche uniquement dans
   * le restaurant actuellement
   * sélectionné.
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name,
      pin_defined
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
    !data
  ) {
    return NextResponse.json(
      {
        error:
          "Utilisateur introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    name:
      data.name,

    pinDefined:
      data.pin_defined,

    restaurant: {
      name:
        access.restaurant.name,
    },
  });
}