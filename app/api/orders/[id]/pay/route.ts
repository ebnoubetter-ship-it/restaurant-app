import { NextResponse } from "next/server";

import { requireApiRestaurantAccess } from "@/lib/api-restaurant-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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

  const { id: orderId } =
    await context.params;

  /*
   * ============================
   * BODY
   * ============================
   */
  let body: {
    paymentMethod?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Requête invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const paymentMethod =
    typeof body.paymentMethod ===
    "string"
      ? body.paymentMethod.trim()
      : "";

  if (!paymentMethod) {
    return NextResponse.json(
      {
        error:
          "Mode de paiement invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * MODE DE PAIEMENT
   * ============================
   *
   * Le moyen de paiement doit être
   * actif pour CE restaurant.
   */
  const {
    data: configuredPaymentMethod,
    error: paymentMethodError,
  } = await supabaseAdmin
    .from("payment_methods")
    .select("id, name")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "name",
      paymentMethod
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();

  if (paymentMethodError) {
    console.error(
      "PAYMENT METHOD CHECK ERROR:",
      paymentMethodError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier le mode de paiement.",
      },
      {
        status: 500,
      }
    );
  }

  if (!configuredPaymentMethod) {
    return NextResponse.json(
      {
        error:
          "Mode de paiement invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * COMMANDE
   * ============================
   *
   * Important :
   * la commande doit appartenir
   * au restaurant connecté.
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
      order_type,
      order_number,
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
          "Commande introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    order.status !== "open"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette commande est déjà clôturée.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * TABLE
   * ============================
   *
   * On récupère la table séparément
   * pour vérifier qu'elle appartient
   * bien au même restaurant.
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
      error: tableLookupError,
    } = await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .select("id, name")
      .eq(
        "id",
        order.table_id
      )
      .eq(
        "restaurant_id",
        restaurantId
      )
      .maybeSingle();

    if (tableLookupError) {
      console.error(
        "PAYMENT TABLE LOOKUP ERROR:",
        tableLookupError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier la table.",
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
            "La table associée à cette commande est invalide.",
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
   * ============================
   * SHIFT ACTUEL
   * ============================
   *
   * Le caissier doit avoir
   * un shift ouvert dans
   * CE restaurant.
   */
  const {
    data: currentShift,
    error: shiftError,
  } = await supabaseAdmin
    .from("shifts")
    .select("id")
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "cashier_id",
      session.id
    )
    .eq(
      "status",
      "open"
    )
    .order(
      "started_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (shiftError) {
    console.error(
      "PAYMENT SHIFT ERROR:",
      shiftError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer le shift.",
      },
      {
        status: 500,
      }
    );
  }

  if (!currentShift) {
    return NextResponse.json(
      {
        error:
          "Vous devez ouvrir votre shift avant d'encaisser.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * ARTICLES
   * ============================
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
      unit_price,
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
      "PAYMENT ITEMS ERROR:",
      itemsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les articles de la commande.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ============================
   * PRODUITS
   * ============================
   *
   * On vérifie aussi que les produits
   * appartiennent au restaurant.
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
    menuItemIds.length > 0
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
      console.error(
        "PAYMENT PRODUCTS ERROR:",
        productsError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de récupérer les produits de la commande.",
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

    /*
     * Si un article pointe vers un produit
     * d'un autre restaurant ou vers une
     * configuration incohérente, on refuse
     * l'encaissement.
     */
    const invalidProduct =
      (items || []).some(
        (item) =>
          !item.menu_item_id ||
          !productMap.has(
            item.menu_item_id
          )
      );

    if (invalidProduct) {
      return NextResponse.json(
        {
          error:
            "La commande contient un produit invalide.",
        },
        {
          status: 409,
        }
      );
    }
  }

  /*
   * ============================
   * SÉCURITÉ CUISINE
   * ============================
   *
   * Tous les articles actifs doivent
   * avoir été envoyés avant paiement.
   */
  const hasPendingKitchenItems =
    (items || []).some(
      (item) => {
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

        return (
          quantity >
          sentQuantity
        );
      }
    );

  if (
    hasPendingKitchenItems
  ) {
    return NextResponse.json(
      {
        error:
          "Envoyez tous les articles en cuisine avant d'encaisser.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * ============================
   * TOTAL
   * ============================
   */
  const total =
    (items || []).reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.quantity ||
            0
        ) *
          Number(
            item.unit_price ||
              0
          ),
      0
    );

  if (total <= 0) {
    return NextResponse.json(
      {
        error:
          "La commande est vide.",
      },
      {
        status: 400,
      }
    );
  }

  const paidAt =
    new Date().toISOString();

  /*
   * ============================
   * ENREGISTREMENT DU PAIEMENT
   * ============================
   *
   * Les conditions empêchent :
   * - paiement d'un autre restaurant
   * - double paiement
   * - paiement après annulation
   */
  const {
    data: paidOrder,
    error: paymentError,
  } = await supabaseAdmin
    .from("orders")
    .update({
      status:
        "paid",

      total,

      payment_method:
        configuredPaymentMethod.name,

      paid_at:
        paidAt,

      shift_id:
        currentShift.id,
    })
    .eq(
      "id",
      orderId
    )
    .eq(
      "restaurant_id",
      restaurantId
    )
    .eq(
      "status",
      "open"
    )
    .select(`
      id,
      status,
      total,
      payment_method,
      paid_at,
      shift_id
    `)
    .maybeSingle();

  if (paymentError) {
    console.error(
      "PAYMENT UPDATE ERROR:",
      paymentError
    );

    return NextResponse.json(
      {
        error:
          "Impossible d'enregistrer le paiement.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * Une autre requête a déjà
   * clôturé la commande.
   */
  if (!paidOrder) {
    return NextResponse.json(
      {
        error:
          "Cette commande vient déjà d'être clôturée. Aucun second paiement n'a été enregistré.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * ============================
   * LIBÉRATION DE LA TABLE
   * ============================
   */
  let tableReleased =
    true;

  if (
    order.order_type ===
      "dine_in" &&
    order.table_id
  ) {
    const {
      error: tableError,
    } = await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .update({
        status:
          "available",
      })
      .eq(
        "id",
        order.table_id
      )
      .eq(
        "restaurant_id",
        restaurantId
      );

    if (tableError) {
      console.error(
        "PAYMENT TABLE RELEASE ERROR:",
        tableError
      );

      tableReleased =
        false;
    }
  }

  /*
   * ============================
   * EMPLACEMENT
   * ============================
   */
  const location =
    order.order_type ===
    "takeaway"
      ? "À emporter"
      : tableName ||
        "Table";

  /*
   * ============================
   * TICKET
   * ============================
   */
  const receiptItems =
    (items || []).map(
      (item) => {
        const product =
          item.menu_item_id
            ? productMap.get(
                item.menu_item_id
              )
            : undefined;

        const quantity =
          Number(
            item.quantity ||
              0
          );

        const unitPrice =
          Number(
            item.unit_price ||
              0
          );

        return {
          name:
            product?.name ||
            "Produit",

          category:
            product?.category ||
            "",

          quantity,

          unitPrice,

          lineTotal:
            quantity *
            unitPrice,
        };
      }
    );

  const ticketPayload = {
    orderId:
      order.id,

    orderNumber:
      order.order_number,

    location,

    orderType:
      order.order_type,

    createdAt:
      order.created_at,

    paidAt:
      paidOrder.paid_at,

    paymentMethod:
      paidOrder.payment_method,

    total:
      Number(
        paidOrder.total
      ),

    items:
      receiptItems,
  };

  /*
   * ============================
   * FILE D'IMPRESSION CAISSE
   * ============================
   *
   * restaurant_id est maintenant
   * enregistré explicitement.
   */
  const {
    data: printJob,
    error: printJobError,
  } = await supabaseAdmin
    .from("print_jobs")
    .insert({
      restaurant_id:
        restaurantId,

      order_id:
        orderId,

      shift_id:
        currentShift.id,

      created_by:
        session.id,

      printer_role:
        "cashier",

      job_type:
        "customer_receipt",

      status:
        "pending",

      payload:
        ticketPayload,
    })
    .select("id")
    .single();

  const printJobCreated =
    !printJobError &&
    Boolean(
      printJob
    );

  if (printJobError) {
    console.error(
      "PAYMENT PRINT JOB ERROR:",
      printJobError
    );
  }

  /*
   * ============================
   * WARNING
   * ============================
   */
  const warnings:
    string[] = [];

  if (!tableReleased) {
    warnings.push(
      "La table n'a pas pu être libérée."
    );
  }

  if (!printJobCreated) {
    warnings.push(
      "Le ticket client n'a pas pu être préparé."
    );
  }

  const warning =
    warnings.length > 0
      ? `Le paiement est enregistré, mais ${warnings.join(
          " "
        )}`
      : null;

  return NextResponse.json({
    success: true,

    total:
      Number(
        paidOrder.total
      ),

    orderNumber:
      order.order_number,

    printJobCreated,

    printJobId:
      printJob?.id ||
      null,

    tableReleased,

    warning,
  });
}