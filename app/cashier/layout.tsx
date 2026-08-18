import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";

import RestaurantAccessGuard from "@/components/RestaurantAccessGuard";

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access =
    await getSessionRestaurantAccess();

  /*
   * Pas de session ou ancienne session
   * sans restaurantId.
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
   * Mauvais rôle.
   */
  if (
    access.session.role !==
    "cashier"
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