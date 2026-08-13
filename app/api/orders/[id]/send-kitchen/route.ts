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

  const {
    data: order,
    error: orderError,
  } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      order_number,
      order_type,
      created_at,
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
    order.status !== "open"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette commande ne peut plus être envoyée en cuisine.",
      },
      { status: 400 }
    );
  }

  const {
    data: items,
    error: itemsError,
  } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      quantity,
      sent_quantity,
      menu_items (
        id,
        name,
        category
      )
    `)
    .eq("order_id", orderId)
    .gt("quantity", 0)
    .order("created_at", {
      ascending: true,
    });

  if (itemsError) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les articles.",
      },
      { status: 500 }
    );
  }

  const pendingItems =
    (items || [])
      .map((item) => {
        const quantity =
          Number(
            item.quantity || 0
          );

        const sentQuantity =
          Number(
            item.sent_quantity || 0
          );

        const quantityToSend =
          Math.max(
            quantity -
              sentQuantity,
            0
          );

        const product =
          Array.isArray(
            item.menu_items
          )
            ? item.menu_items[0]
            : item.menu_items;

        return {
          id: item.id,

          currentQuantity:
            quantity,

          previousSentQuantity:
            sentQuantity,

          quantityToSend,

          product: {
            id:
              product?.id || "",

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
    pendingItems.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Aucun nouvel article à envoyer en cuisine.",
      },
      { status: 400 }
    );
  }

  const table =
    Array.isArray(
      order.restaurant_tables
    )
      ? order.restaurant_tables[0]
      : order.restaurant_tables;

  const location =
    order.order_type ===
    "takeaway"
      ? "À emporter"
      : table?.name ||
        "Table";

  const isAddition =
    Boolean(
      order.sent_to_kitchen_at
    );

  /*
   * On garde la liste des articles
   * effectivement mis à jour.
   *
   * Elle nous permettra de revenir en
   * arrière si la création du ticket
   * échoue.
   */
  const updatedItems: {
    id: string;
    previousSentQuantity: number;
  }[] = [];

  for (
    const item of pendingItems
  ) {
    const {
      error: updateError,
    } = await supabaseAdmin
      .from("order_items")
      .update({
        sent_quantity:
          item.currentQuantity,
      })
      .eq(
        "id",
        item.id
      );

    if (updateError) {
      /*
       * Retour en arrière sur les
       * articles déjà modifiés.
       */
      for (
        const updatedItem of
        updatedItems
      ) {
        await supabaseAdmin
          .from("order_items")
          .update({
            sent_quantity:
              updatedItem.previousSentQuantity,
          })
          .eq(
            "id",
            updatedItem.id
          );
      }

      return NextResponse.json(
        {
          error:
            "Impossible d'enregistrer l'envoi en cuisine.",
        },
        { status: 500 }
      );
    }

    updatedItems.push({
      id: item.id,
      previousSentQuantity:
        item.previousSentQuantity,
    });
  }

  const sentAt =
    new Date().toISOString();

  if (
    !order.sent_to_kitchen_at
  ) {
    const {
      error: orderUpdateError,
    } = await supabaseAdmin
      .from("orders")
      .update({
        sent_to_kitchen_at:
          sentAt,
      })
      .eq(
        "id",
        orderId
      );

    if (orderUpdateError) {
      for (
        const updatedItem of
        updatedItems
      ) {
        await supabaseAdmin
          .from("order_items")
          .update({
            sent_quantity:
              updatedItem.previousSentQuantity,
          })
          .eq(
            "id",
            updatedItem.id
          );
      }

      return NextResponse.json(
        {
          error:
            "Impossible d'enregistrer l'envoi de la commande.",
        },
        { status: 500 }
      );
    }
  }

  /*
   * Snapshot exact du ticket.
   *
   * Même si la commande change ensuite,
   * ce ticket restera identique.
   */
  const ticketPayload = {
    orderId:
      order.id,

    orderNumber:
      order.order_number,

    location,

    orderType:
      order.order_type,

    type:
      isAddition
        ? "addition"
        : "initial",

    sentAt,

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
        isAddition
          ? "kitchen_addition"
          : "kitchen_order",

      status:
        "pending",

      payload:
        ticketPayload,
    })
    .select("id")
    .single();

  if (
    printJobError ||
    !printJob
  ) {
    /*
     * Si le ticket n'a pas pu être créé,
     * on remet sent_quantity dans son
     * état précédent.
     */
    for (
      const updatedItem of
      updatedItems
    ) {
      await supabaseAdmin
        .from("order_items")
        .update({
          sent_quantity:
            updatedItem.previousSentQuantity,
        })
        .eq(
          "id",
          updatedItem.id
        );
    }

    /*
     * Si c'était le premier envoi,
     * on annule aussi sent_to_kitchen_at.
     */
    if (
      !order.sent_to_kitchen_at
    ) {
      await supabaseAdmin
        .from("orders")
        .update({
          sent_to_kitchen_at:
            null,
        })
        .eq(
          "id",
          orderId
        );
    }

    return NextResponse.json(
      {
        error:
          "Impossible de préparer le ticket cuisine.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,

    type:
      isAddition
        ? "addition"
        : "initial",

    printJobId:
      printJob.id,

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