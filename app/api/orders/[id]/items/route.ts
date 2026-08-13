import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { id: orderId } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select(`
      id,
      quantity,
      unit_price,
      sent_quantity,
      cancelled_quantity,
      cancelled_after_send_quantity,
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

  if (error) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer la commande.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { id: orderId } = await context.params;
  const { menuItemId } = await request.json();

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404 }
    );
  }

  if (order.status !== "open") {
    return NextResponse.json(
      {
        error:
          "Cette commande ne peut plus être modifiée.",
      },
      { status: 400 }
    );
  }

  const {
    data: menuItem,
    error: menuError,
  } = await supabaseAdmin
    .from("menu_items")
    .select("id, price")
    .eq("id", menuItemId)
    .eq("active", true)
    .single();

  if (menuError || !menuItem) {
    return NextResponse.json(
      { error: "Produit introuvable." },
      { status: 404 }
    );
  }

  const { data: existingItem } =
    await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        quantity
      `)
      .eq("order_id", orderId)
      .eq("menu_item_id", menuItemId)
      .maybeSingle();

  if (existingItem) {
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity:
          Number(existingItem.quantity) + 1,
      })
      .eq("id", existingItem.id);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Impossible de modifier la quantité.",
        },
        { status: 500 }
      );
    }
  } else {
    const { error } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: orderId,
        menu_item_id: menuItemId,
        quantity: 1,
        unit_price: menuItem.price,
        sent_quantity: 0,
        cancelled_quantity: 0,
        cancelled_after_send_quantity: 0,
      });

    if (error) {
      return NextResponse.json(
        {
          error:
            "Impossible d'ajouter le produit.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { id: orderId } = await context.params;

  const {
    itemId,
    action,
    reason,
    cancelQuantity,
  } = await request.json();

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
      restaurant_tables (
        name
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404 }
    );
  }

  if (order.status !== "open") {
    return NextResponse.json(
      {
        error:
          "Cette commande ne peut plus être modifiée.",
      },
      { status: 400 }
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
      cancelled_after_send_quantity,
      menu_items (
        id,
        name,
        category
      )
    `)
    .eq("id", itemId)
    .eq("order_id", orderId)
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: "Élément introuvable." },
      { status: 404 }
    );
  }

  const quantity =
    Number(item.quantity || 0);

  const sentQuantity =
    Number(item.sent_quantity || 0);

  const cancelledQuantity =
    Number(item.cancelled_quantity || 0);

  const cancelledAfterSendQuantity =
    Number(
      item.cancelled_after_send_quantity || 0
    );

  /*
   * AUGMENTER
   */
  if (action === "increase") {
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity: quantity + 1,
      })
      .eq("id", itemId);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Impossible d'augmenter la quantité.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * DIMINUER
   *
   * Tant qu'une quantité n'a pas encore été
   * envoyée, il s'agit d'une simple correction.
   */
  if (action === "decrease") {
    if (quantity <= 0) {
      return NextResponse.json(
        {
          error:
            "Aucune quantité à diminuer.",
        },
        { status: 400 }
      );
    }

    const unsentQuantity =
      Math.max(
        quantity - sentQuantity,
        0
      );

    if (unsentQuantity <= 0) {
      return NextResponse.json(
        {
          error:
            "Cet article a déjà été envoyé en cuisine. Utilisez l'annulation de l'article.",
          requiresCancellation: true,
        },
        { status: 409 }
      );
    }

    const newQuantity =
      quantity - 1;

    if (
      newQuantity === 0 &&
      cancelledQuantity === 0
    ) {
      const { error } =
        await supabaseAdmin
          .from("order_items")
          .delete()
          .eq("id", itemId);

      if (error) {
        return NextResponse.json(
          {
            error:
              "Impossible de supprimer l'article.",
          },
          { status: 500 }
        );
      }
    } else {
      const { error } =
        await supabaseAdmin
          .from("order_items")
          .update({
            quantity:
              newQuantity,
          })
          .eq("id", itemId);

      if (error) {
        return NextResponse.json(
          {
            error:
              "Impossible de modifier la quantité.",
          },
          { status: 500 }
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
  if (action === "delete") {
    if (sentQuantity > 0) {
      return NextResponse.json(
        {
          error:
            "Cet article a déjà été envoyé en cuisine. Utilisez l'annulation de l'article.",
          requiresCancellation: true,
        },
        { status: 409 }
      );
    }

    if (cancelledQuantity > 0) {
      const { error } =
        await supabaseAdmin
          .from("order_items")
          .update({
            quantity: 0,
          })
          .eq("id", itemId);

      if (error) {
        return NextResponse.json(
          {
            error:
              "Impossible de supprimer l'article.",
          },
          { status: 500 }
        );
      }
    } else {
      const { error } =
        await supabaseAdmin
          .from("order_items")
          .delete()
          .eq("id", itemId);

      if (error) {
        return NextResponse.json(
          {
            error:
              "Impossible de supprimer l'article.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * ANNULER UN ARTICLE
   */
  if (action === "cancel") {
    const cleanReason =
      typeof reason === "string"
        ? reason.trim()
        : "";

    if (!cleanReason) {
      return NextResponse.json(
        {
          error:
            "Le motif d'annulation est obligatoire.",
        },
        { status: 400 }
      );
    }

    const quantityToCancel =
      Number(cancelQuantity || 1);

    if (
      !Number.isInteger(quantityToCancel) ||
      quantityToCancel <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Quantité à annuler invalide.",
        },
        { status: 400 }
      );
    }

    if (
      quantityToCancel >
      quantity
    ) {
      return NextResponse.json(
        {
          error:
            "La quantité à annuler dépasse la quantité de la commande.",
        },
        { status: 400 }
      );
    }

    /*
     * On consomme d'abord les quantités
     * qui ne sont pas encore parties en cuisine.
     */
    const unsentQuantity =
      Math.max(
        quantity - sentQuantity,
        0
      );

    const cancelledBeforeKitchen =
      Math.min(
        quantityToCancel,
        unsentQuantity
      );

    const cancelledAfterKitchen =
      quantityToCancel -
      cancelledBeforeKitchen;

    const newQuantity =
      quantity -
      quantityToCancel;

    const newSentQuantity =
      Math.max(
        sentQuantity -
          cancelledAfterKitchen,
        0
      );

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("order_items")
      .update({
        quantity:
          newQuantity,

        sent_quantity:
          newSentQuantity,

        cancelled_quantity:
          cancelledQuantity +
          quantityToCancel,

        cancelled_after_send_quantity:
          cancelledAfterSendQuantity +
          cancelledAfterKitchen,
      })
      .eq("id", itemId);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "Impossible d'annuler l'article.",
        },
        { status: 500 }
      );
    }

    /*
     * HISTORIQUE D'ANNULATION
     */
    const cancellationRows = [];

    if (
      cancelledBeforeKitchen > 0
    ) {
      cancellationRows.push({
        order_id:
          orderId,

        order_item_id:
          itemId,

        quantity:
          cancelledBeforeKitchen,

        reason:
          cleanReason,

        after_kitchen:
          false,

        cashier_id:
          session.id,
      });
    }

    if (
      cancelledAfterKitchen > 0
    ) {
      cancellationRows.push({
        order_id:
          orderId,

        order_item_id:
          itemId,

        quantity:
          cancelledAfterKitchen,

        reason:
          cleanReason,

        after_kitchen:
          true,

        cashier_id:
          session.id,
      });
    }

    if (
      cancellationRows.length > 0
    ) {
      const {
        error:
          cancellationError,
      } = await supabaseAdmin
        .from(
          "order_item_cancellations"
        )
        .insert(
          cancellationRows
        );

      if (
        cancellationError
      ) {
        /*
         * On remet l'article dans son état
         * précédent pour éviter une annulation
         * sans historique.
         */
        await supabaseAdmin
          .from("order_items")
          .update({
            quantity,

            sent_quantity:
              sentQuantity,

            cancelled_quantity:
              cancelledQuantity,

            cancelled_after_send_quantity:
              cancelledAfterSendQuantity,
          })
          .eq(
            "id",
            itemId
          );

        return NextResponse.json(
          {
            error:
              "Impossible d'enregistrer l'annulation de l'article.",
          },
          { status: 500 }
        );
      }
    }

    /*
     * TICKET CUISINE
     *
     * Seulement pour la quantité qui avait
     * déjà réellement été envoyée en cuisine.
     */
    let printJobCreated =
      false;

    let printJobId:
      | string
      | null = null;

    if (
      cancelledAfterKitchen >
      0
    ) {
      const product =
        Array.isArray(
          item.menu_items
        )
          ? item.menu_items[0]
          : item.menu_items;

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

      const cancelledAt =
        new Date().toISOString();

      const ticketPayload = {
        orderId:
          order.id,

        orderNumber:
          order.order_number,

        location,

        orderType:
          order.order_type,

        type:
          "item_cancel",

        cancelledAt,

        reason:
          cleanReason,

        item: {
          name:
            product?.name ||
            "Produit",

          category:
            product?.category ||
            "",

          quantity:
            cancelledAfterKitchen,
        },
      };

      const {
        data: printJob,
        error:
          printJobError,
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
            "kitchen_item_cancel",

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
        printJobCreated =
          true;

        printJobId =
          printJob.id;
      }
    }

    return NextResponse.json({
      success: true,

      cancelledQuantity:
        quantityToCancel,

      cancelledBeforeKitchen,

      cancelledAfterKitchen,

      requiresKitchenNotice:
        cancelledAfterKitchen >
        0,

      printJobCreated,

      printJobId,

      warning:
        cancelledAfterKitchen >
          0 &&
        !printJobCreated
          ? "L'article a été annulé, mais le ticket d'annulation cuisine n'a pas pu être préparé."
          : null,
    });
  }

  return NextResponse.json(
    {
      error:
        "Action invalide.",
    },
    { status: 400 }
  );
}