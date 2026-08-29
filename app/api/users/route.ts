import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const allowedRoles = [
  "admin",
  "cashier",
  "stock_manager",
] as const;

export async function GET() {
  const t =
    await getTranslations(
      "ApiUsers"
    );

  /*
   * ============================
   * ADMIN DU RESTAURANT
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "admin",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  /*
   * ============================
   * UTILISATEURS DU RESTAURANT
   * ============================
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name,
      role,
      pin_defined,
      created_at
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "GET USERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.getUsersFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(
    data || []
  );
}

export async function POST(
  request: Request
) {
  const t =
    await getTranslations(
      "ApiUsers"
    );

  /*
   * ============================
   * ADMIN DU RESTAURANT
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "admin",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    name?: unknown;
    role?: unknown;
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

  const name =
    typeof body.name ===
    "string"
      ? body.name.trim()
      : "";

  const role =
    typeof body.role ===
    "string"
      ? body.role
      : "";

  if (
    !name ||
    !allowedRoles.includes(
      role as
        (typeof allowedRoles)[number]
    )
  ) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidNameOrRole"
          ),
      },
      {
        status: 400,
      }
    );
  }

  if (
    name.length > 100
  ) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.nameTooLong"
          ),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * DOUBLON DANS CE RESTAURANT
   * ============================
   */
  const {
    data: existingUser,
    error: existingUserError,
  } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .ilike(
      "name",
      name
    )
    .limit(1)
    .maybeSingle();

  if (existingUserError) {
    console.error(
      "CHECK USER ERROR:",
      existingUserError
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.checkUserFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (existingUser) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.userAlreadyExists"
          ),
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * CRÉATION
   * ============================
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .insert({
      restaurant_id:
        restaurantId,

      name,

      role,

      pin_defined:
        false,

      pin_hash:
        null,
    })
    .select(`
      id,
      name,
      role,
      pin_defined
    `)
    .single();

  if (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    if (
      error.code === "23505"
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.userAlreadyExists"
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
            "errors.createUserFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(
    data,
    {
      status: 201,
    }
  );
}

export async function DELETE(
  request: Request
) {
  const t =
    await getTranslations(
      "ApiUsers"
    );

  /*
   * ============================
   * ADMIN DU RESTAURANT
   * ============================
   */
  const access =
    await requireApiRestaurantAccess([
      "admin",
    ]);

  if (!access.success) {
    return access.response;
  }

  const restaurantId =
    access.restaurant.id;

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    id?: unknown;
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

  const userId =
    typeof body.id ===
      "string"
      ? body.id.trim()
      : "";

  if (!userId) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.invalidUser"
          ),
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * UTILISATEUR CIBLE
   * ============================
   */
  const {
    data: targetUser,
    error: targetUserError,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name,
      role
    `)
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "id",
      userId
    )
    .maybeSingle();

  if (targetUserError) {
    console.error(
      "DELETE USER LOOKUP ERROR:",
      targetUserError
    );

    return NextResponse.json(
      {
        error:
          t(
            "errors.checkUserFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (!targetUser) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.userNotFound"
          ),
      },
      {
        status: 404,
      }
    );
  }

  /*
   * ============================
   * PROTECTION DERNIER ADMIN
   * ============================
   */
  if (
    targetUser.role ===
    "admin"
  ) {
    const {
      count,
      error: adminCountError,
    } = await supabaseAdmin
      .from("users")
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .eq(
        "role",
        "admin"
      );

    if (adminCountError) {
      console.error(
        "COUNT ADMINS ERROR:",
        adminCountError
      );

      return NextResponse.json(
        {
          error:
            t(
              "errors.checkAdminsFailed"
            ),
        },
        {
          status: 500,
        }
      );
    }

    if (
      (count || 0) <= 1
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.lastAdminCannotBeDeleted"
            ),
        },
        {
          status: 409,
        }
      );
    }
  }

  /*
   * ============================
   * SUPPRESSION
   * ============================
   */
  const {
    data: deletedUser,
    error: deleteError,
  } = await supabaseAdmin
    .from("users")
    .delete()
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "id",
      userId
    )
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error(
      "DELETE USER ERROR:",
      deleteError
    );

    if (
      deleteError.code ===
      "23503"
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "errors.userLinkedToHistory"
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
            "errors.deleteUserFailed"
          ),
      },
      {
        status: 500,
      }
    );
  }

  if (!deletedUser) {
    return NextResponse.json(
      {
        error:
          t(
            "errors.userNotFound"
          ),
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,
  });
}