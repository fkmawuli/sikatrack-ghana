import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import MobileHeader from "@/components/layout/MobileHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen">
      <Sidebar
        role={session.user.role}
        businessName={business?.name ?? ""}
        userName={session.user.name ?? ""}
      />
      <div className="flex flex-col min-w-0 lg:pl-64">
        <MobileHeader businessName={business?.name ?? ""} />
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <BottomNav role={session.user.role} />
    </div>
  );
}
