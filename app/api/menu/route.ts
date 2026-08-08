import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "cashier") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, category, price")
    .eq("active", true)
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: "Impossible de récupérer le menu." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}