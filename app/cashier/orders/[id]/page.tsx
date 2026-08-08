import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      total,
      created_at,
      restaurant_tables (
        name,
        zone
      )
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    notFound();
    }

    const table = Array.isArray(order.restaurant_tables)
    ? order.restaurant_tables[0]
    : order.restaurant_tables;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/cashier"
          className="text-sm text-sky-600"
        >
          ← Retour aux tables
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Commande en cours
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            {table?.name}
          </h1>

          <p className="mt-2 text-slate-500">
            Zone : {table?.zone}
          </p>

          <div className="mt-8 rounded-xl bg-slate-50 p-6">
            <p className="text-slate-500">
              Aucun produit ajouté pour le moment.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="font-semibold">
              Total
            </span>

            <span className="text-2xl font-bold">
              {order.total} MRU
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}