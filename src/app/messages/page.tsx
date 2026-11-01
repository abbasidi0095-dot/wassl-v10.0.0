import { requireRole } from "@/lib/auth";
import { getChatThreads, getCities, getUserById } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const session = await requireRole("customer");
  const { thread } = await searchParams;
  const { t } = await getTranslator();
  const [cities, user, threads] = await Promise.all([
    getCities(),
    getUserById(session.userId),
    getChatThreads(session),
  ]);
  const city =
    cities.find((entry) => entry.slug === user?.citySlug) ??
    cities.find((entry) => entry.slug === "dakhla") ??
    cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl py-6 lg:py-10">
        <div className="mb-5 max-w-2xl">
          <div className="eyebrow">{t("Wassl support")}</div>
          <h1 className="display mt-2 text-[clamp(2rem,1.6rem+2vw,3rem)]">
            {t("Messages")}
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            {t(
              "Ask the Wassl assistant, follow an order or ride, or talk to a human agent. Support chats are kept with the order they belong to.",
            )}
          </p>
        </div>
        <ChatWorkspace
          initialThreads={threads}
          initialThreadId={thread}
          role="customer"
          title={t("Conversations")}
          subtitle={t("Assistant, stores, drivers and support")}
        />
      </main>
      <SiteFooter />
    </>
  );
}
