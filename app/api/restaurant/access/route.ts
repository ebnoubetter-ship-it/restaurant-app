import { NextResponse } from "next/server";
import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRestaurantContext } from "@/lib/restaurant-context";
import { deleteSession } from "@/lib/session";

export async function POST(
  request: Request
) {
  let body: {
    token?: unknown;
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

  const token =
    typeof body.token ===
    "string"
      ? body.token.trim()
      : "";

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Lien d'accès invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Le token brut n'est jamais
   * recherché ni stocké en BDD.
   */
  const tokenHash =
    createHash("sha256")
      .update(token)
      .digest("hex");

  const {
    data: restaurant,
    error,
  } = await supabaseAdmin
    .from("restaurants")
    .select(`
      id,
      name,
      active
    `)
    .eq(
      "access_token_hash",
      tokenHash
    )
    .maybeSingle();

  if (error) {
    console.error(
      "RESTAURANT ACCESS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier l'accès.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * On ne révèle pas si le token
   * correspond ou non à un restaurant.
   */
  if (!restaurant) {
    return NextResponse.json(
      {
        error:
          "Lien d'accès invalide.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * Règle officielle MAIDA.
   */
  if (!restaurant.active) {
    return NextResponse.json(
      {
        error:
          "Votre accès est restreint. Contactez le support MAIDA.",
        restricted: true,
      },
      {
        status: 403,
      }
    );
  }

  /*
   * Si cet appareil était connecté
   * à un autre restaurant, on force
   * une nouvelle authentification.
   */
  await deleteSession();

  /*
   * Le navigateur ne conservera
   * ensuite que le restaurantId
   * signé dans un cookie HttpOnly.
   */
  await createRestaurantContext({
    restaurantId:
      restaurant.id,

    restaurantName:
      restaurant.name,
  });

  return NextResponse.json({
    success: true,

    restaurant: {
      name:
        restaurant.name,
    },
  });
}