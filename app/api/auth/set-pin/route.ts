import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  const { name, pin } = await request.json();

  if (!name || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "PIN invalide." },
      { status: 400 }
    );
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, name, role, pin_defined")
    .ilike("name", name.trim())
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json(
      { error: "Utilisateur introuvable." },
      { status: 404 }
    );
  }

  if (user.pin_defined) {
    return NextResponse.json(
      { error: "Un PIN existe déjà." },
      { status: 400 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({
      pin_hash: pinHash,
      pin_defined: true,
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Impossible de créer le PIN." },
      { status: 500 }
    );
  }

  await createSession({
    id: user.id,
    name: user.name,
    role: user.role,
  });

  return NextResponse.json({
    success: true,
    role: user.role,
  });
}