import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const allowedRoles = [
  "admin",
  "cashier",
  "stock_manager",
] as const;

export async function GET() {
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

  /*
   * ============================
   * UTILISATEURS DU RESTAURANT
   * ============================
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name,
      role,
      pin_defined,
      created_at
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "GET USERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les utilisateurs.",
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

export async function POST(
  request: Request
) {
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

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    name?: unknown;
    role?: unknown;
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

  const name =
    typeof body.name ===
    "string"
      ? body.name.trim()
      : "";

  const role =
    typeof body.role ===
    "string"
      ? body.role
      : "";

  if (
    !name ||
    !allowedRoles.includes(
      role as
        (typeof allowedRoles)[number]
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Nom ou rôle invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    name.length > 100
  ) {
    return NextResponse.json(
      {
        error:
          "Le nom est trop long.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * DOUBLON DANS CE RESTAURANT
   * ============================
   *
   * Ahmed chez Appetizer
   * et Ahmed chez MAIDA TEST
   * sont autorisés.
   *
   * Deux Ahmed dans le même
   * restaurant ne le sont pas.
   */
  const {
    data: existingUser,
    error: existingUserError,
  } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .ilike(
      "name",
      name
    )
    .limit(1)
    .maybeSingle();

  if (existingUserError) {
    console.error(
      "CHECK USER ERROR:",
      existingUserError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier l'utilisateur.",
      },
      {
        status: 500,
      }
    );
  }

  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "Un utilisateur avec ce nom existe déjà.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * CRÉATION
   * ============================
   *
   * restaurant_id est écrit
   * explicitement.
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .insert({
      restaurant_id:
        restaurantId,

      name,

      role,

      pin_defined:
        false,

      pin_hash:
        null,
    })
    .select(`
      id,
      name,
      role,
      pin_defined
    `)
    .single();

  if (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    /*
     * Lorsque nous ajouterons la
     * contrainte unique DB, elle
     * protégera également les créations
     * simultanées.
     */
    if (
      error.code === "23505"
    ) {
      return NextResponse.json(
        {
          error:
            "Un utilisateur avec ce nom existe déjà.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossible de créer l'utilisateur.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(
    data,
    {
      status: 201,
    }
  );
}