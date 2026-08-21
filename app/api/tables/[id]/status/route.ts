import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const allowedStatuses = [
  "available",
  "reserved",
  "occupied",
] as const;

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  const { id } =
    await context.params;

  let body: {
    status?: unknown;
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

  const status =
    typeof body.status ===
    "string"
      ? body.status
      : "";

  if (
    !allowedStatuses.includes(
      status as
        (typeof allowedStatuses)[number]
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Statut invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Important :
   *
   * une table d'un autre restaurant
   * ne peut jamais être modifiée.
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "restaurant_tables"
    )
    .update({
      status,
    })
    .eq(
      "id",
      id
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .select(
      "id, name, zone, status"
    )
    .maybeSingle();

  if (error) {
    console.error(
      "TABLE STATUS UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de modifier la table.",
      },
      {
        status: 500,
      }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error:
          "Table introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(
    data
  );
}