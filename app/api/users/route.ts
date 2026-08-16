import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

const allowedRoles = [
  "admin",
  "cashier",
  "stock_manager",
] as const;

async function requireAdmin() {
  const session = await getSession();

  if (!session) {
    return {
      error: NextResponse.json(
        {
          error:
            "Authentification requise.",
        },
        {
          status: 401,
        }
      ),
      session: null,
    };
  }

  if (
    session.role !== "admin"
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "Accès réservé aux administrateurs.",
        },
        {
          status: 403,
        }
      ),
      session: null,
    };
  }

  return {
    error: null,
    session,
  };
}

export async function GET() {
  const auth =
    await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

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
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "GET USERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les utilisateurs.",
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
  const auth =
    await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

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
          "Requête invalide.",
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
          "Nom ou rôle invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Évite les noms vides/très longs.
   * Cela protège aussi l'interface
   * contre des saisies accidentelles.
   */
  if (name.length > 100) {
    return NextResponse.json(
      {
        error:
          "Le nom est trop long.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Recherche insensible à la casse.
   * "Ahmed" et "ahmed" ne doivent
   * pas créer deux accès distincts.
   */
  const {
    data: existingUser,
    error: existingUserError,
  } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("name", name)
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
          "Impossible de vérifier l'utilisateur.",
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
          "Un utilisateur avec ce nom existe déjà.",
      },
      {
        status: 409,
      }
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("users")
    .insert({
      name,
      role,
      pin_defined: false,
      pin_hash: null,
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

    return NextResponse.json(
      {
        error:
          "Impossible de créer l'utilisateur.",
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