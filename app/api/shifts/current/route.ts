import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .select("id, started_at, ended_at, status")
    .eq("cashier_id", session.id)
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Impossible de récupérer le shift." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    shift: shift || null,
  });
}