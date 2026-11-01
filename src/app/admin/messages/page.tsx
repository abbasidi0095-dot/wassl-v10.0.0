import { requireRole } from "@/lib/auth";
import { getChatThreads } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support inbox" };

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const session = await requireRole("admin");
  const { thread } = await searchParams;
  const threads = await getChatThreads(session);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Support inbox"
        subtitle="Customer, store and driver conversations"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <ChatWorkspace
          initialThreads={threads}
          initialThreadId={thread}
          role="admin"
          title="Support inbox"
          subtitle="Reply as operations; AI stops after a human reply"
        />
      </main>
    </div>
  );
}
