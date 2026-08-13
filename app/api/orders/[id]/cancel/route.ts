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

  const body =
    await request.json();

  const reason =
    typeof body.reason === "string"
      ? body.reason.trim()
      : "";

  if (!reason) {
    return NextResponse.json(
      {
        error:
          "Le motif d'annulation est obligatoire.",
      },
      { status: 400 }
    );
  }

  const {
    data: order,
    error: orderError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      table_id,
      order_type,
      order_number,
      sent_to_kitchen_at,
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
        error: "Commande introuvable.",
      },
      { status: 404 }
    );
  }

  if (
    order.status === "paid"
  ) {
    return NextResponse.json(
      {
        error:
          "Une commande déjà payée ne peut pas être annulée.",
      },
      { status: 400 }
    );
  }

  if (
    order.status ===
    "cancelled"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette commande est déjà annulée.",
      },
      { status: 400 }
    );
  }

  const cancelledAt =
    new Date().toISOString();

  /*
   * 1. ANNULER LA COMMANDE
   */
  const {
    error: cancelError,
  } = await supabaseAdmin
    .from("orders")
    .update({
      status: "cancelled",
      cancellation_reason:
        reason,
      cancelled_at:
        cancelledAt,
      cancelled_by:
        session.id,
    })
    .eq("id", orderId)
    .eq("status", "open");

  if (cancelError) {
    return NextResponse.json(
      {
        error:
          "Impossible d'annuler la commande.",
      },
      { status: 500 }
    );
  }

  /*
   * 2. LIBÉRER LA TABLE
   *
   * Seulement pour une commande
   * sur place.
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
   * 3. TICKET D'ANNULATION CUISINE
   *
   * Seulement si la commande avait déjà
   * été envoyée en cuisine.
   */
  const wasSentToKitchen =
    Boolean(
      order.sent_to_kitchen_at
    );

  let printJobId:
    | string
    | null = null;

  let printJobCreated = false;

  if (wasSentToKitchen) {
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

    const ticketPayload = {
      orderId:
        order.id,

      orderNumber:
        order.order_number,

      location,

      orderType:
        order.order_type,

      type:
        "order_cancel",

      reason,

      cancelledAt,
    };

    const {
      data: printJob,
      error: printJobError,
    } = await supabaseAdmin
      .from("print_jobs")
      .insert({
        order_id:
          orderId,

        created_by:
          session.id,

        printer_role:
          "kitchen",

        job_type:
          "kitchen_order_cancel",

        status:
          "pending",

        payload:
          ticketPayload,
      })
      .select("id")
      .single();

    if (
      !printJobError &&
      printJob
    ) {
      printJobCreated = true;
      printJobId =
        printJob.id;
    }
  }

  /*
   * On ne remet pas la commande en "open"
   * si l'impression échoue.
   *
   * L'annulation métier reste prioritaire.
   */
  return NextResponse.json({
    success: true,

    wasSentToKitchen,

    tableReleased,

    printJobCreated,

    printJobId,

    warning:
      !tableReleased
        ? "La commande a été annulée, mais la table n'a pas pu être libérée."
        : wasSentToKitchen &&
          !printJobCreated
        ? "La commande a été annulée, mais le ticket cuisine n'a pas pu être préparé."
        : null,
  });
}