import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

const allowedMethods = [
  "Bankily",
  "Masrivi",
  "Sedad",
  "BCI PAY",
  "Cash",
] as const;

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  /*
   * ============================
   * AUTHENTIFICATION
   * ============================
   */
  const session = await getSession();

  if (
    !session ||
    session.role !== "cashier"
  ) {
    return NextResponse.json(
      {
        error: "Accès non autorisé.",
      },
      {
        status: 403,
      }
    );
  }

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
        error: "Requête invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const paymentMethod =
    typeof body.paymentMethod === "string"
      ? body.paymentMethod
      : "";

  if (
    !allowedMethods.includes(
      paymentMethod as
        (typeof allowedMethods)[number]
    )
  ) {
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
   * SHIFT ACTUEL
   * ============================
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
      (sum, item) =>
        sum +
        Number(
          item.quantity || 0
        ) *
          Number(
            item.unit_price || 0
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
   * IMPORTANT :
   *
   * On met à jour uniquement si la
   * commande est encore OPEN.
   *
   * Puis on demande à PostgreSQL de
   * retourner la ligne effectivement
   * modifiée.
   *
   * Si aucune ligne n'est retournée,
   * une autre requête a probablement
   * déjà payé ou clôturé la commande.
   */
  const {
    data: paidOrder,
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
   * Une autre requête a gagné la course.
   *
   * On s'arrête AVANT :
   * - libération de la table
   * - création du ticket
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
   *
   * Le paiement est déjà valide à ce
   * stade.
   *
   * Une erreur de libération ne doit
   * donc pas annuler le paiement.
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
      console.error(
        "PAYMENT TABLE RELEASE ERROR:",
        tableError
      );

      tableReleased = false;
    }
  }

  /*
   * ============================
   * EMPLACEMENT
   * ============================
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
   * ============================
   * CONTENU DU TICKET
   * ============================
   */
  const receiptItems =
    (items || []).map(
      (item) => {
        const product =
          Array.isArray(
            item.menu_items
          )
            ? item
                .menu_items[0]
            : item.menu_items;

        const quantity =
          Number(
            item.quantity || 0
          );

        const unitPrice =
          Number(
            item.unit_price || 0
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
   *
   * Le paiement reste valide même si
   * une étape secondaire échoue.
   */
  const warnings: string[] =
    [];

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