import "server-only";

import {
  getSession,
  type SessionUser,
} from "@/lib/session";

import { supabaseAdmin } from "@/lib/supabase-admin";

type ActiveAccess = {
  status: "active";

  session: SessionUser & {
    restaurantId: string;
  };

  restaurant: {
    id: string;
    name: string;
  };
};

type UnauthenticatedAccess = {
  status: "unauthenticated";
};

type RestrictedAccess = {
  status: "restricted";
};

export type SessionRestaurantAccess =
  | ActiveAccess
  | UnauthenticatedAccess
  | RestrictedAccess;

export async function getSessionRestaurantAccess(): Promise<SessionRestaurantAccess> {
  const session =
    await getSession();

  if (
    !session ||
    !session.restaurantId
  ) {
    return {
      status: "unauthenticated",
    };
  }

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
      "id",
      session.restaurantId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "SESSION RESTAURANT CHECK ERROR:",
      error
    );

    /*
     * En cas d'incertitude, on ne
     * laisse pas passer l'utilisateur.
     */
    return {
      status: "unauthenticated",
    };
  }

  if (!restaurant) {
    return {
      status: "unauthenticated",
    };
  }

  if (!restaurant.active) {
    return {
      status: "restricted",
    };
  }

  return {
    status: "active",

    session: {
      ...session,
      restaurantId:
        session.restaurantId,
    },

    restaurant: {
      id:
        restaurant.id,

      name:
        restaurant.name,
    },
  };
}