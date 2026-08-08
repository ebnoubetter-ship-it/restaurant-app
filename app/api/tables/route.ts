import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .select("id, code, name, zone, status")
    .order("zone", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Impossible de récupérer les tables." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}