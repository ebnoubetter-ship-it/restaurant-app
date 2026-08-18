import { redirect } from "next/navigation";

import { getSessionRestaurantAccess } from "@/lib/session-restaurant-access";

import RestaurantAccessGuard from "@/components/RestaurantAccessGuard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access =
    await getSessionRestaurantAccess();

  if (
    access.status ===
    "unauthenticated"
  ) {
    redirect("/login");
  }

  if (
    access.status ===
    "restricted"
  ) {
    redirect("/restricted");
  }

  if (
    access.session.role !==
    "admin"
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