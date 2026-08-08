import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { status } = await request.json();

  const allowedStatuses = [
    "available",
    "reserved",
    "occupied",
  ];

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Statut invalide." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .update({ status })
    .eq("id", id)
    .select("id, name, zone, status")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible de modifier la table." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}