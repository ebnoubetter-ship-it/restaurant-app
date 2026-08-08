import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "cashier") {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}