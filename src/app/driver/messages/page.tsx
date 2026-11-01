import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getChatThreads } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Driver messages" };

export default async function DriverMessagesPage() {
  const session = await requireRole("driver");
  if (!session.driverId) redirect("/login?next=driver");
  const threads = await getChatThreads(session);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Driver messages"
        subtitle="Customer and operations conversations"
        links={[
          { href: "/driver", label: "My route" },
          { href: "/driver/taxi", label: "Taxi rides" },
          { href: "/driver/messages", label: "Messages" },
        ]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <ChatWorkspace
          initialThreads={threads}
          role="driver"
          title="Conversations"
          subtitle="Customers assigned to you"
        />
      </main>
    </div>
  );
}
