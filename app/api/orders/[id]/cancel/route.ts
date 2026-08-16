import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

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
          "Requête invalide.",
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
          "Le motif d'annulation est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    reason.length > 500
  ) {
    return NextResponse.json(
      {
        error:
          "Le motif d'annulation est trop long.",
      },
      {
        status: 400,
      }
    );
  }

  const cancelledAt =
    new Date().toISOString();

  /*
   * Une seule transaction DB :
   *
   * - verrou commande
   * - vérification OPEN
   * - annulation
   * - libération table
   * - décision ticket cuisine
   */
  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      "cancel_order_atomic",
      {
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
        "ORDER_PAID"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Une commande déjà payée ne peut pas être annulée.",
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
            "Cette commande est déjà annulée.",
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
            "Cette commande ne peut plus être annulée.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossible d'annuler la commande.",
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

  if (
    !result?.success
  ) {
    return NextResponse.json(
      {
        error:
          "L'annulation a retourné un résultat invalide.",
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

  const warnings: string[] =
    [];

  if (!tableReleased) {
    warnings.push(
      "la table n'a pas pu être libérée."
    );
  }

  if (
    wasSentToKitchen &&
    !printJobCreated
  ) {
    warnings.push(
      "le ticket cuisine n'a pas pu être préparé."
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
        ? `La commande a été annulée, mais ${warnings.join(
            " "
          )}`
        : null,
  });
}