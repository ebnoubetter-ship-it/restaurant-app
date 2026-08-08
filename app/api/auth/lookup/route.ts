import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { name } = await request.json();

  const cleanName = name?.trim();

  if (!cleanName) {
    return NextResponse.json(
      { error: "Nom requis." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, pin_defined")
    .ilike("name", cleanName)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Utilisateur introuvable." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    name: data.name,
    pinDefined: data.pin_defined,
  });
}