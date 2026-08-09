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

  const { data: shift, error: shiftError } =
    await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("cashier_id", session.id)
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .maybeSingle();

  if (shiftError || !shift) {
    return NextResponse.json(
      { error: "Aucun shift ouvert." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("shifts")
    .update({
      status: "closed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", shift.id);

  if (error) {
    return NextResponse.json(
      { error: "Impossible de fermer le shift." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}