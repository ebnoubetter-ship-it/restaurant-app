"use client";

import LogoutButton from "@/components/LogoutButton";

type TableStatus = "available" | "reserved" | "occupied";

type RestaurantTable = {
  id: string;
  name: string;
  zone: "VIP" | "Terrasse" | "Salle";
  status: TableStatus;
};

const tables: RestaurantTable[] = [
  { id: "vip-a", name: "VIP A", zone: "VIP", status: "available" },
  { id: "vip-b", name: "VIP B", zone: "VIP", status: "available" },

  ...["A", "B", "C", "D", "E", "F"].map((letter) => ({
    id: `terrasse-${letter.toLowerCase()}`,
    name: `Box Terrasse ${letter}`,
    zone: "Terrasse" as const,
    status: "available" as const,
  })),

  ...Array.from({ length: 50 }, (_, index) => ({
    id: `table-${index + 1}`,
    name: `Table ${index + 1}`,
    zone: "Salle" as const,
    status: "available" as const,
  })),
];

export default function CashierPage() {
  const getStatusStyle = (status: TableStatus) => {
    if (status === "occupied") {
      return "border-red-300 bg-red-100 text-red-700";
    }

    if (status === "reserved") {
      return "border-orange-300 bg-orange-100 text-orange-700";
    }

    return "border-green-300 bg-green-100 text-green-700";
  };

  const getStatusLabel = (status: TableStatus) => {
    if (status === "occupied") return "Occupée";
    if (status === "reserved") return "Réservée";

    return "Disponible";
  };

  const renderZone = (
    title: string,
    zone: RestaurantTable["zone"]
  ) => {
    const zoneTables = tables.filter(
      (table) => table.zone === zone
    );

    return (
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">
          {title}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {zoneTables.map((table) => (
            <button
              key={table.id}
              onClick={() => {
                alert(`${table.name} - ${getStatusLabel(table.status)}`);
              }}
              className={`min-h-24 rounded-2xl border p-4 text-left transition hover:scale-[1.02] ${getStatusStyle(
                table.status
              )}`}
            >
              <p className="font-semibold">
                {table.name}
              </p>

              <p className="mt-2 text-sm">
                {getStatusLabel(table.status)}
              </p>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const available = tables.filter(
    (table) => table.status === "available"
  ).length;

  const reserved = tables.filter(
    (table) => table.status === "reserved"
  ).length;

  const occupied = tables.filter(
    (table) => table.status === "occupied"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Espace caissier
            </p>

            <h1 className="text-3xl font-bold">
              Tables
            </h1>
          </div>

          <LogoutButton />
        </header>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Disponibles
            </p>

            <p className="mt-1 text-2xl font-bold text-green-600">
              {available}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Réservées
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-500">
              {reserved}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Occupées
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {occupied}
            </p>
          </div>
        </div>

        {renderZone("VIP", "VIP")}

        {renderZone(
          "Box Terrasse",
          "Terrasse"
        )}

        {renderZone(
          "Salle",
          "Salle"
        )}
      </div>
    </main>
  );
}