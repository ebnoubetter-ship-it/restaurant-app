import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  const { name, pin } = await request.json();

  if (!name || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Nom ou PIN invalide." },
      { status: 400 }
    );
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, name, role, pin_hash, pin_defined")
    .ilike("name", name.trim())
    .maybeSingle();

  if (error || !user || !user.pin_defined || !user.pin_hash) {
    return NextResponse.json(
      { error: "Connexion impossible." },
      { status: 401 }
    );
  }

  const validPin = await bcrypt.compare(
    pin,
    user.pin_hash
  );

  if (!validPin) {
    return NextResponse.json(
      { error: "PIN incorrect." },
      { status: 401 }
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