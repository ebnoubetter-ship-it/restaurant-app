import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

type KitchenRpcResult = {
  success?: boolean;
  type?: "initial" | "addition";
  printJobId?: string;
};

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const t =
    await getTranslations(
      "ApiOrderSendKitchen"
    );

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

  const { id: orderId } =
    await context.params;

  /*
   * COMMANDE
   */
  const {
    data: order,
    error: orderError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      table_id,
      status,
      order_number,
      order_type,
      created_at
    `)
    .eq(
      "id",
      orderId
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (
    orderError ||
    !order
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.orderNotFound"),
      },
      {
        status: 404,
      }
    );
  }

  if (
    order.status !==
    "open"
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.orderNotSendable"),
      },
      {
        status: 409,
      }
    );
  }

  /*
   * EMPLACEMENT
   */
  let tableName:
    | string
    | null = null;

  if (
    order.order_type ===
      "dine_in" &&
    order.table_id
  ) {
    const {
      data: table,
      error: tableError,
    } = await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .select("name")
      .eq(
        "id",
        order.table_id
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .maybeSingle();

    if (tableError) {
      return NextResponse.json(
        {
          error:
            t("errors.getTableFailed"),
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
            t("errors.invalidTable"),
        },
        {
          status: 409,
        }
      );
    }

    tableName =
      table.name;
  }

  /*
   * ARTICLES
   */
  const {
    data: items,
    error: itemsError,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      menu_item_id,
      quantity,
      sent_quantity
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "order_id",
      orderId
    )
    .gt(
      "quantity",
      0
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (itemsError) {
    console.error(
      "SEND KITCHEN ITEMS ERROR:",
      itemsError
    );

    return NextResponse.json(
      {
        error:
          t("errors.getItemsFailed"),
      },
      {
        status: 500,
      }
    );
  }

  /*
   * PRODUITS DU RESTAURANT
   */
  const menuItemIds = [
    ...new Set(
      (items || [])
        .map(
          (item) =>
            item.menu_item_id
        )
        .filter(
          (
            id
          ): id is string =>
            typeof id ===
              "string" &&
            id.length > 0
        )
    ),
  ];

  const productMap =
    new Map<
      string,
      {
        id: string;
        name: string;
        category: string;
      }
    >();

  if (
    menuItemIds.length >
    0
  ) {
    const {
      data: products,
      error: productsError,
    } = await supabaseAdmin
      .from("menu_items")
      .select(`
        id,
        name,
        category
      `)
      .eq(
        "restaurant_id",
        restaurantId
      )
      .in(
        "id",
        menuItemIds
      );

    if (productsError) {
      return NextResponse.json(
        {
          error:
            t("errors.getProductsFailed"),
        },
        {
          status: 500,
        }
      );
    }

    for (
      const product of
      products || []
    ) {
      productMap.set(
        product.id,
        product
      );
    }
  }

  /*
   * ARTICLES À ENVOYER
   */
  const pendingItems =
    (items || [])
      .map((item) => {
        const quantity =
          Number(
            item.quantity ||
              0
          );

        const sentQuantity =
          Number(
            item.sent_quantity ||
              0
          );

        const quantityToSend =
          Math.max(
            quantity -
              sentQuantity,
            0
          );

        const product =
          item.menu_item_id
            ? productMap.get(
                item.menu_item_id
              )
            : undefined;

        return {
          id:
            item.id,

          currentQuantity:
            quantity,

          previousSentQuantity:
            sentQuantity,

          quantityToSend,

          product: {
            id:
              product?.id ||
              "",

            name:
              product?.name ||
              "Produit",

            category:
              product?.category ||
              "",
          },
        };
      })
      .filter(
        (item) =>
          item.quantityToSend >
          0
      );

  if (
    pendingItems.length ===
    0
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.noPendingItems"),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Aucun produit d'un autre restaurant
   * ne doit se glisser dans la commande.
   */
  const invalidProduct =
    pendingItems.some(
      (item) =>
        !item.product.id
    );

  if (invalidProduct) {
    return NextResponse.json(
      {
        error:
          t("errors.invalidProduct"),
      },
      {
        status: 409,
      }
    );
  }

  const location =
    order.order_type ===
    "takeaway"
      ? "À emporter"
      : tableName ||
        "Table";

  const sentAt =
    new Date().toISOString();

  const ticketPayload = {
    orderId:
      order.id,

    orderNumber:
      order.order_number,

    location,

    orderType:
      order.order_type,

    items:
      pendingItems.map(
        (item) => ({
          name:
            item.product.name,

          category:
            item.product
              .category,

          quantity:
            item.quantityToSend,
        })
      ),
  };

  const expectedItems =
    pendingItems.map(
      (item) => ({
        id:
          item.id,

        currentQuantity:
          item.currentQuantity,

        previousSentQuantity:
          item.previousSentQuantity,
      })
    );

  /*
   * OPÉRATION ATOMIQUE
   */
  const {
    data: rpcData,
    error: rpcError,
  } = await supabaseAdmin.rpc(
    "send_order_to_kitchen_atomic",
    {
      p_restaurant_id:
        restaurantId,

      p_order_id:
        orderId,

      p_created_by:
        session.id,

      p_sent_at:
        sentAt,

      p_expected_items:
        expectedItems,

      p_ticket_payload:
        ticketPayload,
    }
  );

  if (rpcError) {
    console.error(
      "SEND KITCHEN RPC ERROR:",
      rpcError
    );

    const message =
      rpcError.message || "";

    if (
      message.includes(
        "RESTAURANT_INACTIVE"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.restricted"),

          restricted:
            true,
        },
        {
          status: 403,
        }
      );
    }

    if (
      message.includes(
        "USER_NOT_FOUND"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.unauthorized"),
        },
        {
          status: 403,
        }
      );
    }

    if (
      message.includes(
        "ORDER_NOT_FOUND"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.orderNotFound"),
        },
        {
          status: 404,
        }
      );
    }

    if (
      message.includes(
        "ORDER_NOT_OPEN"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.orderJustClosed"),
        },
        {
          status: 409,
        }
      );
    }

    if (
      message.includes(
        "NO_PENDING_ITEMS"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.itemsAlreadySent"),
        },
        {
          status: 409,
        }
      );
    }

    if (
      message.includes(
        "ORDER_CHANGED"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.orderChanged"),
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          t("errors.sendFailed"),
      },
      {
        status: 500,
      }
    );
  }

  const result =
    rpcData as
      | KitchenRpcResult
      | null;

  if (
    !result?.printJobId ||
    !result.type
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.invalidResult"),
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,

    type:
      result.type,

    printJobId:
      result.printJobId,

    orderNumber:
      order.order_number,

    location,

    items:
      pendingItems.map(
        (item) => ({
          name:
            item.product.name,

          category:
            item.product
              .category,

          quantity:
            item.quantityToSend,
        })
      ),
  });
}