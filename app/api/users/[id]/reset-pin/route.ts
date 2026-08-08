import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      pin_hash: null,
      pin_defined: false,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Impossible de réinitialiser le PIN." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}