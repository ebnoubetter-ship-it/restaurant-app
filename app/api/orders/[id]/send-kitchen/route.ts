import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

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
  /*
   * ============================
   * AUTHENTIFICATION
   * ============================
   */
  const session =
    await getSession();

  if (
    !session ||
    session.role !==
      "cashier"
  ) {
    return NextResponse.json(
      {
        error:
          "Accès non autorisé.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: orderId,
  } = await context.params;

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
      status,
      order_number,
      order_type,
      created_at,
      restaurant_tables (
        name
      )
    `)
    .eq(
      "id",
      orderId
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
          "Cette commande ne peut plus être envoyée en cuisine.",
      },
      {
        status: 409,
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
      "SEND KITCHEN ITEMS ERROR:",
      itemsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les articles.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * ============================
   * ARTICLES À ENVOYER
   * ============================
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
          "Aucun nouvel article à envoyer en cuisine.",
      },
      {
        status: 400,
      }
    );
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

  const sentAt =
    new Date().toISOString();

  /*
   * Snapshot du contenu qui doit
   * apparaître sur le ticket.
   *
   * Le type "initial/addition" et
   * sentAt sont ajoutés dans la
   * fonction PostgreSQL.
   */
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

  /*
   * État exact attendu par la DB.
   *
   * Si la commande change entre
   * cette lecture et l'opération
   * atomique, PostgreSQL refusera
   * l'envoi.
   */
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
   * ============================
   * OPÉRATION ATOMIQUE
   * ============================
   *
   * Cette fonction :
   *
   * - verrouille la commande
   * - verrouille ses articles
   * - revalide les quantités
   * - met à jour sent_quantity
   * - définit sent_to_kitchen_at
   * - crée le print_job
   *
   * Si une étape échoue, aucune
   * partie ne doit être validée.
   */
  const {
    data: rpcData,
    error: rpcError,
  } = await supabaseAdmin.rpc(
    "send_order_to_kitchen_atomic",
    {
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
      rpcError.message ||
      "";

    if (
      message.includes(
        "ORDER_NOT_FOUND"
      )
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
      message.includes(
        "ORDER_NOT_OPEN"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Cette commande vient d'être clôturée.",
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
            "Les articles ont déjà été envoyés en cuisine.",
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
            "La commande a changé pendant l'envoi. Actualisez-la puis réessayez.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossible d'enregistrer l'envoi en cuisine.",
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
    console.error(
      "SEND KITCHEN INVALID RPC RESULT:",
      rpcData
    );

    return NextResponse.json(
      {
        error:
          "L'envoi cuisine a retourné un résultat invalide.",
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