import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const access =
    await requireApiRestaurantAccess();

  if (!access.success) {
    return access.response;
  }

  return NextResponse.json(
    {
      authenticated: true,

      active: true,

      restaurant: {
        id:
          access.restaurant.id,

        name:
          access.restaurant.name,
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}