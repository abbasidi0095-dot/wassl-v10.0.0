import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getChatThreads } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store messages" };

export default async function MerchantMessagesPage() {
  const session = await requireRole("merchant");
  if (!session.storeId) redirect("/login?next=merchant");
  const threads = await getChatThreads(session);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Store messages"
        subtitle="Customer and operations conversations"
        links={[
          { href: "/merchant", label: "Orders" },
          { href: "/merchant/grocery", label: "Grocery" },
          { href: "/merchant/messages", label: "Messages" },
        ]}
      />
      <main className="container-wassl py-6">
        <ChatWorkspace
          initialThreads={threads}
          role="merchant"
          title="Conversations"
          subtitle="Customers who messaged your store"
        />
      </main>
    </div>
  );
}
