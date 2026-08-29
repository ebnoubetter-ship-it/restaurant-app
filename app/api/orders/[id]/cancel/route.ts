import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CancelOrderResult = {
  success?: boolean;
  wasSentToKitchen?: boolean;
  tableReleased?: boolean;
  printJobCreated?: boolean;
  printJobId?: string | null;
};

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
      "ApiOrderCancel"
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
    reason?: unknown;
  };

  try {
    body =
      await request.json();
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

  const reason =
    typeof body.reason ===
    "string"
      ? body.reason.trim()
      : "";

  if (!reason) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.reasonRequired"
          ),
      },
      {
        status: 400,
      }
    );
  }

  if (
    reason.length >
    500
  ) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.reasonTooLong"
          ),
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
      "cancel_order_atomic",
      {
        p_restaurant_id:
          restaurantId,

        p_order_id:
          orderId,

        p_cancelled_by:
          session.id,

        p_reason:
          reason,

        p_cancelled_at:
          cancelledAt,
      }
    );

  if (error) {
    console.error(
      "CANCEL ORDER RPC ERROR:",
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
            t(
              "errors.restricted"
            ),

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
            t(
              "errors.unauthorized"
            ),
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
            t(
              "errors.orderNotFound"
            ),
        },
        {
          status: 404,
        }
      );
    }

    if (
      message.includes(
        "ORDER_PAID"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.orderPaid"
            ),
        },
        {
          status: 409,
        }
      );
    }

    if (
      message.includes(
        "ORDER_ALREADY_CANCELLED"
      )
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.alreadyCancelled"
            ),
        },
        {
          status: 409,
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
            t(
              "errors.orderNotOpen"
            ),
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          t(
            "errors.cancelFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  const result =
    data as
      | CancelOrderResult
      | null;

  if (!result?.success) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidResult"
          ),
      },
      {
        status: 500,
      }
    );
  }

  const wasSentToKitchen =
    Boolean(
      result.wasSentToKitchen
    );

  const tableReleased =
    result.tableReleased !==
    false;

  const printJobCreated =
    Boolean(
      result.printJobCreated
    );

  const warnings:
    string[] = [];

  if (!tableReleased) {
    warnings.push(
      t(
        "warnings.tableNotReleased"
      )
    );
  }

  if (
    wasSentToKitchen &&
    !printJobCreated
  ) {
    warnings.push(
      t(
        "warnings.kitchenTicketFailed"
      )
    );
  }

  return NextResponse.json({
    success: true,

    wasSentToKitchen,

    tableReleased,

    printJobCreated,

    printJobId:
      result.printJobId ||
      null,

    warning:
      warnings.length > 0
        ? t(
            "warnings.cancelledWithWarnings",
            {
              warnings:
                warnings.join(
                  " "
                ),
            }
          )
        : null,
  });
}