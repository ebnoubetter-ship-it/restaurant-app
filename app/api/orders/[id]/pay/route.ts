import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const session = await getSession();

  if (
    !session ||
    session.role !== "cashier"
  ) {
    return NextResponse.json(
      {
        error: "Accès non autorisé.",
      },
      { status: 403 }
    );
  }

  const { id: orderId } =
    await context.params;

  const { paymentMethod } =
    await request.json();

  const allowedMethods = [
    "Bankily",
    "Masrivi",
    "Sedad",
    "BCI PAY",
    "Cash",
  ];

  if (
    !allowedMethods.includes(
      paymentMethod
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Mode de paiement invalide.",
      },
      { status: 400 }
    );
  }

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
      order_type,
      order_number,
      created_at,
      restaurant_tables (
        name
      )
    `)
    .eq("id", orderId)
    .single();

  if (
    orderError ||
    !order
  ) {
    return NextResponse.json(
      {
        error:
          "Commande introuvable.",
      },
      { status: 404 }
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
      { status: 400 }
    );
  }

  /*
   * SHIFT ACTUEL
   */
  const {
    data: currentShift,
    error: shiftError,
  } = await supabaseAdmin
    .from("shifts")
    .select("id")
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
    .maybeSingle();

  if (shiftError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer le shift.",
      },
      { status: 500 }
    );
  }

  if (!currentShift) {
    return NextResponse.json(
      {
        error:
          "Vous devez ouvrir votre shift avant d'encaisser.",
      },
      { status: 400 }
    );
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
      quantity,
      unit_price,
      sent_quantity,
      menu_items (
        id,
        name,
        category
      )
    `)
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
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les articles de la commande.",
      },
      { status: 500 }
    );
  }

  /*
   * SÉCURITÉ CUISINE
   *
   * Tous les articles actifs doivent
   * avoir été envoyés avant paiement.
   */
  const hasPendingKitchenItems =
    (items || []).some(
      (item) => {
        const quantity =
          Number(
            item.quantity || 0
          );

        const sentQuantity =
          Number(
            item.sent_quantity || 0
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
      { status: 400 }
    );
  }

  /*
   * TOTAL
   */
  const total = (
    items || []
  ).reduce(
    (sum, item) =>
      sum +
      Number(
        item.quantity
      ) *
        Number(
          item.unit_price
        ),
    0
  );

  if (total <= 0) {
    return NextResponse.json(
      {
        error:
          "La commande est vide.",
      },
      { status: 400 }
    );
  }

  const paidAt =
    new Date().toISOString();

  /*
   * ENREGISTREMENT DU PAIEMENT
   */
  const {
    error: paymentError,
  } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      total,
      payment_method:
        paymentMethod,
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
      "status",
      "open"
    );

  if (paymentError) {
    return NextResponse.json(
      {
        error:
          "Impossible d'enregistrer le paiement.",
      },
      { status: 500 }
    );
  }

  /*
   * LIBÉRATION DE LA TABLE
   */
  let tableReleased = true;

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
        status: "available",
      })
      .eq(
        "id",
        order.table_id
      );

    if (tableError) {
      tableReleased = false;
    }
  }

  /*
   * NOM DE LA TABLE / À EMPORTER
   */
  const table =
    Array.isArray(
      order.restaurant_tables
    )
      ? order
          .restaurant_tables[0]
      : order.restaurant_tables;

  const location =
    order.order_type ===
    "takeaway"
      ? "À emporter"
      : table?.name ||
        "Table";

  /*
   * CONTENU DU TICKET CLIENT
   */
  const receiptItems =
    (items || []).map(
      (item) => {
        const product =
          Array.isArray(
            item.menu_items
          )
            ? item.menu_items[0]
            : item.menu_items;

        const quantity =
          Number(
            item.quantity
          );

        const unitPrice =
          Number(
            item.unit_price
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

    paidAt,

    paymentMethod,

    total,

    items:
      receiptItems,
  };

  /*
   * FILE D'IMPRESSION CAISSE
   */
  const {
    data: printJob,
    error: printJobError,
  } = await supabaseAdmin
    .from("print_jobs")
    .insert({
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
    Boolean(printJob);

  /*
   * Le paiement reste valide même
   * si le ticket ne peut pas être
   * ajouté à la file d'impression.
   */
  let warning:
    | string
    | null = null;

  if (!tableReleased) {
    warning =
      "Le paiement est enregistré, mais la table n'a pas pu être libérée.";
  } else if (
    !printJobCreated
  ) {
    warning =
      "Le paiement est enregistré, mais le ticket client n'a pas pu être préparé.";
  }

  return NextResponse.json({
    success: true,

    total,

    orderNumber:
      order.order_number,

    printJobCreated,

    printJobId:
      printJob?.id || null,

    tableReleased,

    warning,
  });
}