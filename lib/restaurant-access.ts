import "server-only";

import { getRestaurantContext } from "@/lib/restaurant-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ActiveRestaurant = {
  id: string;
  name: string;
};

type RestaurantAccessResult =
  | {
      success: true;
      restaurant: ActiveRestaurant;
    }
  | {
      success: false;
      status: number;
      error: string;
      restricted?: boolean;
    };

export async function getActiveRestaurant(): Promise<RestaurantAccessResult> {
  /*
   * 1. Le restaurant doit avoir été
   * identifié avec son lien/token.
   */
  const context =
    await getRestaurantContext();

  if (!context) {
    return {
      success: false,
      status: 401,
      error:
        "Accès restaurant requis.",
    };
  }

  /*
   * 2. On ne fait pas confiance uniquement
   * au cookie pendant 30 jours.
   *
   * On vérifie l'état ACTUEL du restaurant
   * dans la BDD.
   */
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
      context.restaurantId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "RESTAURANT ACCESS CHECK ERROR:",
      error
    );

    return {
      success: false,
      status: 500,
      error:
        "Impossible de vérifier l'accès au restaurant.",
    };
  }

  if (!restaurant) {
    return {
      success: false,
      status: 401,
      error:
        "Accès restaurant invalide.",
    };
  }

  /*
   * Règle officielle MAIDA :
   * désactiver un restaurant bloque
   * immédiatement son accès.
   */
  if (!restaurant.active) {
    return {
      success: false,
      status: 403,
      error:
        "Votre accès est restreint. Contactez le support MAIDA.",
      restricted: true,
    };
  }

  return {
    success: true,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
    },
  };
}