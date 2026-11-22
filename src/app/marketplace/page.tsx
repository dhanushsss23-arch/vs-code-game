import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Marketplace } from "@/components/marketplace";

export default async function MarketplacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("STUDENT")) redirect("/teacher");
  return <Marketplace locale={user.preferredLocale} />;
}
