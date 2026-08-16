import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  /*
   * Sécurité serveur :
   * l'utilisateur doit être connecté
   * ET posséder le rôle admin.
   */
  const session =
    await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Authentification requise.",
      },
      {
        status: 401,
      }
    );
  }

  if (
    session.role !== "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Accès réservé aux administrateurs.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  if (!id) {
    return NextResponse.json(
      {
        error:
          "Utilisateur invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * On vérifie d'abord que
   * l'utilisateur existe.
   *
   * Une UPDATE Supabase sur un ID
   * inexistant ne génère pas toujours
   * une erreur, donc cette vérification
   * est utile.
   */
  const {
    data: user,
    error: userError,
  } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      name
    `)
    .eq("id", id)
    .maybeSingle();

  if (userError) {
    console.error(
      "RESET PIN USER LOOKUP ERROR:",
      userError
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

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Utilisateur introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: updatedUser,
    error,
  } = await supabaseAdmin
    .from("users")
    .update({
      pin_hash: null,
      pin_defined: false,
    })
    .eq("id", id)
    .select(`
      id,
      name,
      pin_defined
    `)
    .single();

  if (error) {
    console.error(
      "RESET PIN ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de réinitialiser le PIN.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id:
        updatedUser.id,
      name:
        updatedUser.name,
      pin_defined:
        updatedUser.pin_defined,
    },
  });
}