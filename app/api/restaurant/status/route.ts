import { NextResponse } from "next/server";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import { deleteSession } from "@/lib/session";

export async function GET() {
  const access =
    await getSessionRestaurantAccess();

  if (
    access.status ===
    "unauthenticated"
  ) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        status: 401,
      }
    );
  }

  if (
    access.status ===
    "restricted"
  ) {
    /*
     * On déconnecte l'employé,
     * mais on conserve volontairement
     * restaurant_context.
     */
    await deleteSession();

    return NextResponse.json(
      {
        authenticated: false,

        restricted: true,

        error:
          "Votre accès est restreint. Contactez le support MAIDA.",
      },
      {
        status: 403,
      }
    );
  }

  return NextResponse.json({
    authenticated: true,

    active: true,

    restaurant: {
      id:
        access.restaurant.id,

      name:
        access.restaurant.name,
    },
  });
}