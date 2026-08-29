import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const t =
    await getTranslations(
      "ApiOrders"
    );

  /*
   * ============================
   * ACCÈS RESTAURANT + CAISSIER
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const session =
    access.session;

  const restaurantId =
    access.restaurant.id;

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    tableId?: unknown;
    orderType?: unknown;
  };

  try {
    body = await request.json();
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

  const tableId =
    typeof body.tableId === "string" &&
    body.tableId.trim()
      ? body.tableId.trim()
      : null;

  const orderType =
    body.orderType === "takeaway"
      ? "takeaway"
      : "dine_in";

  /*
   * ============================
   * COMMANDE SUR PLACE
   * ============================
   */
  if (orderType === "dine_in") {
    if (!tableId) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.tableRequired"
            ),
        },
        {
          status: 400,
        }
      );
    }

    /*
     * La table doit appartenir
     * au restaurant connecté.
     */
    const {
      data: table,
      error: tableError,
    } = await supabaseAdmin
      .from("restaurant_tables")
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        tableId
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .maybeSingle();

    if (tableError) {
      console.error(
        "CREATE ORDER TABLE CHECK ERROR:",
        tableError
      );

      return NextResponse.json(
        {
          error:
            t(
              "errors.tableCheckFailed"
            ),
        },
        {
          status: 500,
        }
      );
    }

    if (!table) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.tableNotFound"
            ),
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Vérifier si cette table possède
     * déjà une commande ouverte dans
     * CE restaurant.
     *
     * On ne filtre volontairement pas
     * par cashier_id :
     * un autre caissier peut reprendre
     * une table déjà ouverte.
     */
    const {
      data: existingOrder,
      error: existingOrderError,
    } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq(
        "restaurant_id",
        restaurantId
      )
      .eq(
        "table_id",
        tableId
      )
      .eq(
        "status",
        "open"
      )
      .eq(
        "order_type",
        "dine_in"
      )
      .limit(1)
      .maybeSingle();

    if (existingOrderError) {
      console.error(
        "CREATE ORDER EXISTING CHECK ERROR:",
        existingOrderError
      );

      return NextResponse.json(
        {
          error:
            t(
              "errors.tableCheckFailed"
            ),
        },
        {
          status: 500,
        }
      );
    }

    if (existingOrder) {
      return NextResponse.json({
        orderId:
          existingOrder.id,
      });
    }

    /*
     * Création explicite dans le
     * restaurant connecté.
     */
    const {
      data: order,
      error,
    } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id:
          restaurantId,

        table_id:
          tableId,

        cashier_id:
          session.id,

        status:
          "open",

        total:
          0,

        order_type:
          "dine_in",
      })
      .select("id")
      .single();

    if (error) {
      /*
       * Une autre requête peut avoir créé
       * une commande sur la même table
       * entre notre vérification et l'insert.
       *
       * L'index unique PostgreSQL protège
       * déjà ce cas.
       */
      if (
        error.code === "23505"
      ) {
        const {
          data: concurrentOrder,
        } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq(
            "restaurant_id",
            restaurantId
          )
          .eq(
            "table_id",
            tableId
          )
          .eq(
            "status",
            "open"
          )
          .eq(
            "order_type",
            "dine_in"
          )
          .limit(1)
          .maybeSingle();

        if (concurrentOrder) {
          return NextResponse.json({
            orderId:
              concurrentOrder.id,
          });
        }
      }

      console.error(
        "CREATE ORDER ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            t(
              "errors.createOrderFailed"
            ),
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Marquer uniquement la table
     * du restaurant connecté.
     */
    const {
      error: tableUpdateError,
    } = await supabaseAdmin
      .from("restaurant_tables")
      .update({
        status:
          "occupied",
      })
      .eq(
        "id",
        tableId
      )
      .eq(
        "restaurant_id",
        restaurantId
      );

    if (tableUpdateError) {
      console.error(
        "CREATE ORDER TABLE UPDATE ERROR:",
        tableUpdateError
      );
    }

    return NextResponse.json({
      orderId:
        order.id,
    });
  }

  /*
   * ============================
   * COMMANDE À EMPORTER
   * ============================
   */
  const {
    data: takeawayOrder,
    error,
  } = await supabaseAdmin
    .from("orders")
    .insert({
      restaurant_id:
        restaurantId,

      table_id:
        null,

      cashier_id:
        session.id,

      status:
        "open",

      total:
        0,

      order_type:
        "takeaway",
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      "CREATE TAKEAWAY ORDER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.createTakeawayFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    orderId:
      takeawayOrder.id,
  });
}