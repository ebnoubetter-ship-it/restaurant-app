import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ItemCancelResult = {
  success?: boolean;
  cancelledQuantity?: number;
  cancelledBeforeKitchen?: number;
  cancelledAfterKitchen?: number;
  requiresKitchenNotice?: boolean;
  printJobCreated?: boolean;
  printJobId?: string | null;
};

function changedResponse(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 409,
    }
  );
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const t =
    await getTranslations(
      "ApiOrderItems"
    );

  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  const { id: orderId } =
    await context.params;

  /*
   * Vérifier que la commande appartient
   * au restaurant.
   */
  const {
    data: order,
  } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq(
      "id",
      orderId
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (!order) {
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

  const {
    data: items,
    error,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      menu_item_id,
      quantity,
      unit_price,
      sent_quantity,
      cancelled_quantity,
      cancelled_after_send_quantity
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

  if (error) {
    return NextResponse.json(
      {
        error:
          t("errors.getOrderFailed"),
      },
      {
        status: 500,
      }
    );
  }

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

  return NextResponse.json(
    (items || []).map(
      (item) => ({
        ...item,

        menu_items:
          item.menu_item_id
            ? productMap.get(
                item.menu_item_id
              ) || null
            : null,
      })
    )
  );
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const t =
    await getTranslations(
      "ApiOrderItems"
    );

  const access =
    await requireApiRestaurantAccess([
      "cashier",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  const { id: orderId } =
    await context.params;

  let body: {
    menuItemId?: unknown;
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          t("errors.invalidRequest"),
      },
      {
        status: 400,
      }
    );
  }

  const menuItemId =
    typeof body.menuItemId ===
    "string"
      ? body.menuItemId.trim()
      : "";

  if (!menuItemId) {
    return NextResponse.json(
      {
        error:
          t("errors.invalidProduct"),
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: order,
    error: orderError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status
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
          t("errors.orderNotEditable"),
      },
      {
        status: 409,
      }
    );
  }

  const {
    data: menuItem,
    error: menuError,
  } = await supabaseAdmin
    .from("menu_items")
    .select(`
      id,
      price
    `)
    .eq(
      "id",
      menuItemId
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();

  if (
    menuError ||
    !menuItem
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.productNotFound"),
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: existingItem,
    error: existingItemError,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
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
    .eq(
      "menu_item_id",
      menuItemId
    )
    .maybeSingle();

  if (existingItemError) {
    return NextResponse.json(
      {
        error:
          t("errors.orderCheckFailed"),
      },
      {
        status: 500,
      }
    );
  }

  if (existingItem) {
    const quantity =
      Number(
        existingItem.quantity ||
          0
      );

    const sentQuantity =
      Number(
        existingItem.sent_quantity ||
          0
      );

    const {
      data: updatedItem,
      error,
    } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity:
          quantity + 1,
      })
      .eq(
        "id",
        existingItem.id
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .eq(
        "order_id",
        orderId
      )
      .eq(
        "quantity",
        quantity
      )
      .eq(
        "sent_quantity",
        sentQuantity
      )
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            t("errors.updateQuantityFailed"),
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedItem) {
      return changedResponse(
        t("errors.orderChanged")
      );
    }
  } else {
    const {
      error,
    } = await supabaseAdmin
      .from("order_items")
      .insert({
        restaurant_id:
          restaurantId,

        order_id:
          orderId,

        menu_item_id:
          menuItemId,

        quantity:
          1,

        unit_price:
          menuItem.price,

        sent_quantity:
          0,

        cancelled_quantity:
          0,

        cancelled_after_send_quantity:
          0,
      });

    if (error) {
      return NextResponse.json(
        {
          error:
            t("errors.addProductFailed"),
        },
        {
          status: 500,
        }
      );
    }
  }

  return NextResponse.json({
    success: true,
  });
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const t =
    await getTranslations(
      "ApiOrderItems"
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

  let body: {
    itemId?: unknown;
    action?: unknown;
    reason?: unknown;
    cancelQuantity?: unknown;
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          t("errors.invalidRequest"),
      },
      {
        status: 400,
      }
    );
  }

  const itemId =
    typeof body.itemId ===
    "string"
      ? body.itemId
      : "";

  const action =
    typeof body.action ===
    "string"
      ? body.action
      : "";

  if (!itemId) {
    return NextResponse.json(
      {
        error:
          t("errors.invalidItem"),
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: order,
    error: orderError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status
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
          t("errors.orderNotEditable"),
      },
      {
        status: 409,
      }
    );
  }

  const {
    data: item,
    error: itemError,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      quantity,
      order_id,
      sent_quantity,
      cancelled_quantity,
      cancelled_after_send_quantity
    `)
    .eq(
      "id",
      itemId
    )
    .eq(
      "order_id",
      orderId
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .maybeSingle();

  if (
    itemError ||
    !item
  ) {
    return NextResponse.json(
      {
        error:
          t("errors.itemNotFound"),
      },
      {
        status: 404,
      }
    );
  }

  const quantity =
    Number(
      item.quantity || 0
    );

  const sentQuantity =
    Number(
      item.sent_quantity ||
        0
    );

  const cancelledQuantity =
    Number(
      item.cancelled_quantity ||
        0
    );

  const cancelledAfterSendQuantity =
    Number(
      item.cancelled_after_send_quantity ||
        0
    );

  /*
   * AUGMENTER
   */
  if (
    action === "increase"
  ) {
    const {
      data: updatedItem,
      error,
    } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity:
          quantity + 1,
      })
      .eq(
        "id",
        itemId
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .eq(
        "order_id",
        orderId
      )
      .eq(
        "quantity",
        quantity
      )
      .eq(
        "sent_quantity",
        sentQuantity
      )
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            t("errors.increaseQuantityFailed"),
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedItem) {
      return changedResponse(
        t("errors.orderChanged")
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * DIMINUER
   */
  if (
    action === "decrease"
  ) {
    if (quantity <= 0) {
      return NextResponse.json(
        {
          error:
            t("errors.noQuantityToDecrease"),
        },
        {
          status: 400,
        }
      );
    }

    const unsentQuantity =
      Math.max(
        quantity -
          sentQuantity,
        0
      );

    if (
      unsentQuantity <=
      0
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.sentToKitchenUseCancellation"),

          requiresCancellation:
            true,
        },
        {
          status: 409,
        }
      );
    }

    const newQuantity =
      quantity - 1;

    if (
      newQuantity === 0 &&
      cancelledQuantity ===
        0
    ) {
      const {
        data: deletedItem,
        error,
      } = await supabaseAdmin
        .from("order_items")
        .delete()
        .eq(
          "id",
          itemId
        )
        .eq(
          "restaurant_id",
          restaurantId
        )
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "quantity",
          quantity
        )
        .eq(
          "sent_quantity",
          sentQuantity
        )
        .select("id")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              t("errors.deleteItemFailed"),
          },
          {
            status: 500,
          }
        );
      }

      if (!deletedItem) {
        return changedResponse(
        t("errors.orderChanged")
      );
      }
    } else {
      const {
        data: updatedItem,
        error,
      } = await supabaseAdmin
        .from("order_items")
        .update({
          quantity:
            newQuantity,
        })
        .eq(
          "id",
          itemId
        )
        .eq(
          "restaurant_id",
          restaurantId
        )
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "quantity",
          quantity
        )
        .eq(
          "sent_quantity",
          sentQuantity
        )
        .select("id")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              t("errors.updateQuantityFailed"),
          },
          {
            status: 500,
          }
        );
      }

      if (!updatedItem) {
        return changedResponse(
        t("errors.orderChanged")
      );
      }
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * SUPPRIMER
   */
  if (
    action === "delete"
  ) {
    if (
      sentQuantity > 0
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.sentToKitchenUseCancellation"),

          requiresCancellation:
            true,
        },
        {
          status: 409,
        }
      );
    }

    if (
      cancelledQuantity >
      0
    ) {
      const {
        data: updatedItem,
        error,
      } = await supabaseAdmin
        .from("order_items")
        .update({
          quantity: 0,
        })
        .eq(
          "id",
          itemId
        )
        .eq(
          "restaurant_id",
          restaurantId
        )
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "quantity",
          quantity
        )
        .eq(
          "sent_quantity",
          sentQuantity
        )
        .select("id")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              t("errors.deleteItemFailed"),
          },
          {
            status: 500,
          }
        );
      }

      if (!updatedItem) {
        return changedResponse(
        t("errors.orderChanged")
      );
      }
    } else {
      const {
        data: deletedItem,
        error,
      } = await supabaseAdmin
        .from("order_items")
        .delete()
        .eq(
          "id",
          itemId
        )
        .eq(
          "restaurant_id",
          restaurantId
        )
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "quantity",
          quantity
        )
        .eq(
          "sent_quantity",
          sentQuantity
        )
        .select("id")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              t("errors.deleteItemFailed"),
          },
          {
            status: 500,
          }
        );
      }

      if (!deletedItem) {
        return changedResponse(
        t("errors.orderChanged")
      );
      }
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * ANNULER
   */
  if (
    action === "cancel"
  ) {
    const cleanReason =
      typeof body.reason ===
      "string"
        ? body.reason.trim()
        : "";

    if (!cleanReason) {
      return NextResponse.json(
        {
          error:
            t("errors.reasonRequired"),
        },
        {
          status: 400,
        }
      );
    }

    if (
      cleanReason.length >
      500
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.reasonTooLong"),
        },
        {
          status: 400,
        }
      );
    }

    const quantityToCancel =
      Number(
        body.cancelQuantity ??
          1
      );

    if (
      !Number.isInteger(
        quantityToCancel
      ) ||
      quantityToCancel <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.invalidCancelQuantity"),
        },
        {
          status: 400,
        }
      );
    }

    if (
      quantityToCancel >
      quantity
    ) {
      return NextResponse.json(
        {
          error:
            t("errors.cancelQuantityTooHigh"),
        },
        {
          status: 400,
        }
      );
    }

    const cancelledAt =
      new Date().toISOString();

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "cancel_order_item_atomic",
        {
          p_restaurant_id:
            restaurantId,

          p_order_id:
            orderId,

          p_item_id:
            itemId,

          p_cancelled_by:
            session.id,

          p_reason:
            cleanReason,

          p_cancel_quantity:
            quantityToCancel,

          p_expected_quantity:
            quantity,

          p_expected_sent_quantity:
            sentQuantity,

          p_expected_cancelled_quantity:
            cancelledQuantity,

          p_expected_cancelled_after_send_quantity:
            cancelledAfterSendQuantity,

          p_cancelled_at:
            cancelledAt,
        }
      );

    if (error) {
      console.error(
        "CANCEL ITEM RPC ERROR:",
        error
      );

      const message =
        error.message || "";

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
          "ITEM_NOT_FOUND"
        )
      ) {
        return NextResponse.json(
          {
            error:
              t("errors.itemNotFound"),
          },
          {
            status: 404,
          }
        );
      }

      if (
        message.includes(
          "ITEM_CHANGED"
        )
      ) {
        return changedResponse(
        t("errors.orderChanged")
      );
      }

      if (
        message.includes(
          "QUANTITY_TOO_HIGH"
        )
      ) {
        return NextResponse.json(
          {
            error:
              t("errors.availableQuantityChanged"),
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            t("errors.cancelItemFailed"),
        },
        {
          status: 500,
        }
      );
    }

    const result =
      data as
        | ItemCancelResult
        | null;

    if (!result?.success) {
      return NextResponse.json(
        {
          error:
            t("errors.invalidCancellationResult"),
        },
        {
          status: 500,
        }
      );
    }

    const cancelledAfterKitchen =
      Number(
        result.cancelledAfterKitchen ||
          0
      );

    const printJobCreated =
      Boolean(
        result.printJobCreated
      );

    return NextResponse.json({
      success: true,

      cancelledQuantity:
        Number(
          result.cancelledQuantity ||
            quantityToCancel
        ),

      cancelledBeforeKitchen:
        Number(
          result.cancelledBeforeKitchen ||
            0
        ),

      cancelledAfterKitchen,

      requiresKitchenNotice:
        cancelledAfterKitchen >
        0,

      printJobCreated,

      printJobId:
        result.printJobId ||
        null,

      warning:
        cancelledAfterKitchen >
          0 &&
        !printJobCreated
          ? t("warnings.kitchenCancellationTicketFailed")
          : null,
    });
  }

  return NextResponse.json(
    {
      error:
        t("errors.invalidAction"),
    },
    {
      status: 400,
    }
  );
}