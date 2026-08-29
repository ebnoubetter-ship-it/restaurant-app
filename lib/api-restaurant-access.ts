import "server-only";

import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  deleteSession,
  getSession,
  type SessionUser,
  type UserRole,
} from "@/lib/session";

import { getRestaurantContext } from "@/lib/restaurant-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RestaurantInfo = {
  id: string;
  name: string;
};

type AuthorizedAccess = {
  success: true;

  session: SessionUser & {
    restaurantId: string;
  };

  restaurant: RestaurantInfo;
};

type RefusedAccess = {
  success: false;
  response: NextResponse;
};

export type ApiRestaurantAccess =
  | AuthorizedAccess
  | RefusedAccess;

export async function requireApiRestaurantAccess(
  allowedRoles?: UserRole[]
): Promise<ApiRestaurantAccess> {
  const t =
    await getTranslations(
      "ApiRestaurantAccess"
    );

  const session =
    await getSession();

  if (!session) {
    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.authenticationRequired"
              ),
          },
          {
            status: 401,
          }
        ),
    };
  }

  /*
   * Anciennes sessions créées avant
   * l'arrivée de restaurantId.
   *
   * On regarde quand même le contexte
   * restaurant pour détecter un
   * restaurant désactivé.
   */
  if (!session.restaurantId) {
    const context =
      await getRestaurantContext();

    if (context) {
      const {
        data: restaurant,
      } = await supabaseAdmin
        .from("restaurants")
        .select(`
          id,
          active
        `)
        .eq(
          "id",
          context.restaurantId
        )
        .maybeSingle();

      if (
        restaurant &&
        !restaurant.active
      ) {
        await deleteSession();

        return {
          success: false,

          response:
            NextResponse.json(
              {
                error:
                  t(
                    "errors.restricted"
                  ),

                restricted: true,
              },
              {
                status: 403,
              }
            ),
        };
      }
    }

    /*
     * Une ancienne session sans
     * restaurantId n'est plus acceptée.
     */
    await deleteSession();

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.reconnectRequired"
              ),
          },
          {
            status: 401,
          }
        ),
    };
  }

  /*
   * Vérification du restaurant
   * directement en BDD.
   */
  const {
    data: restaurant,
    error: restaurantError,
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

  if (restaurantError) {
    console.error(
      "API RESTAURANT ACCESS ERROR:",
      restaurantError
    );

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.checkAccessFailed"
              ),
          },
          {
            status: 500,
          }
        ),
    };
  }

  if (!restaurant) {
    await deleteSession();

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.invalidRestaurantAccess"
              ),
          },
          {
            status: 401,
          }
        ),
    };
  }

  /*
   * La désactivation prend effet
   * immédiatement côté serveur.
   */
  if (!restaurant.active) {
    await deleteSession();

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.restricted"
              ),

            restricted: true,
          },
          {
            status: 403,
          }
        ),
    };
  }

  /*
   * Vérification du rôle.
   */
  if (
    allowedRoles &&
    !allowedRoles.includes(
      session.role
    )
  ) {
    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.unauthorized"
              ),
          },
          {
            status: 403,
          }
        ),
    };
  }

  /*
   * On vérifie également que
   * l'utilisateur appartient toujours
   * réellement à ce restaurant.
   *
   * Le JWT seul ne suffit donc pas.
   */
  const {
    data: user,
    error: userError,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      restaurant_id,
      role
    `)
    .eq(
      "id",
      session.id
    )
    .eq(
      "restaurant_id",
      session.restaurantId
    )
    .maybeSingle();

  if (
    userError ||
    !user
  ) {
    await deleteSession();

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.invalidSession"
              ),
          },
          {
            status: 401,
          }
        ),
    };
  }

  if (
    user.role !==
    session.role
  ) {
    await deleteSession();

    return {
      success: false,

      response:
        NextResponse.json(
          {
            error:
              t(
                "errors.invalidSession"
              ),
          },
          {
            status: 401,
          }
        ),
    };
  }

  return {
    success: true,

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