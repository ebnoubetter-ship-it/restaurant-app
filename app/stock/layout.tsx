import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "stock_manager") {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}