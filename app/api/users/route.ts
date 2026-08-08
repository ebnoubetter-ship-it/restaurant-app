import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, role, pin_defined, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Impossible de récupérer les utilisateurs." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();

  const name = body.name?.trim();
  const role = body.role;

  const allowedRoles = ["admin", "cashier", "stock_manager"];

  if (!name || !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "Nom ou rôle invalide." },
      { status: 400 }
    );
  }

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "Un utilisateur avec ce nom existe déjà." },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      name,
      role,
      pin_defined: false,
      pin_hash: null,
    })
    .select("id, name, role, pin_defined")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible de créer l'utilisateur." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}