import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";
import RestaurantAccessGuard from "@/components/RestaurantAccessGuard";

export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access =
    await getSessionRestaurantAccess();

  /*
   * Pas de session valide.
   */
  if (
    access.status ===
    "unauthenticated"
  ) {
    redirect("/login");
  }

  /*
   * Restaurant désactivé.
   */
  if (
    access.status ===
    "restricted"
  ) {
    redirect("/restricted");
  }

  /*
   * L'espace stock est réservé
   * au gestionnaire de stock.
   */
  if (
    access.session.role !==
    "stock_manager"
  ) {
    redirect("/unauthorized");
  }

  return (
    <>
      <RestaurantAccessGuard />

      {children}
    </>
  );
}