import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { data: existingShift } = await supabaseAdmin
    .from("shifts")
    .select("id")
    .eq("cashier_id", session.id)
    .eq("status", "open")
    .maybeSingle();

  if (existingShift) {
    return NextResponse.json(
      { error: "Un shift est déjà ouvert." },
      { status: 400 }
    );
  }

  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .insert({
      cashier_id: session.id,
      status: "open",
    })
    .select("id, started_at, status")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible d'ouvrir le shift." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    shift,
  });
}