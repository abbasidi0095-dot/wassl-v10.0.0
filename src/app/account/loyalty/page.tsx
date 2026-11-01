import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Gift,
  History,
  Sparkles,
  Star,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getCities, getLoyaltyOverview, getUserById } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Club" };

export default async function LoyaltyPage() {
  const session = await requireRole("customer");
  const { t } = await getTranslator();
  const [cities, user, overview] = await Promise.all([
    getCities(),
    getUserById(session.userId),
    getLoyaltyOverview(session.userId),
  ]);
  const city =
    cities.find((entry) => entry.slug === user?.citySlug) ??
    cities.find((entry) => entry.slug === "dakhla") ??
    cities[0];
  const { account, progress, transactions, rewards } = overview;
  const tierLabel = t(progress.tier === "plus" ? "Plus" : progress.tier === "premium" ? "Premium" : "Basic");

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl py-8 lg:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              <Sparkles size={14} /> {t("Wassl Club")}
            </div>
            <h1 className="display mt-2 text-[clamp(2.4rem,1.7rem+2.8vw,4rem)]">
              {t("Salam, {name}.", { name: session.name.split(" ")[0] })}
            </h1>
            <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
              {t(
                "Earn points on completed orders, move through Basic, Plus and Premium, and redeem points at grocery checkout.",
              )}
            </p>
          </div>
          <Link href="/grocery" className="btn btn-primary">
            {t("Use points on groceries")} <ArrowRight size={14} />
          </Link>
        </header>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <section className="aero-tile rounded-[10px] border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t("Membership")}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Star size={20} className="fill-signal text-signal" />
                  <span className="font-display text-[30px] font-semibold tracking-[-0.03em]">
                    {tierLabel}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {t("Member since {date}", {
                    date: new Intl.DateTimeFormat("en-GB", {
                      month: "short",
                      year: "numeric",
                    }).format(new Date(account.joinedAt)),
                  })}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t("Available points")}
                </div>
                <div className="mt-1 font-display text-[32px] font-semibold leading-none tnum">
                  {account.points}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{t("Lifetime points")}: {account.lifetimePoints}</span>
                {progress.next ? (
                  <span>
                    {t("{points} to {tier}", {
                      points: progress.pointsToNext,
                      tier: t(progress.next.label),
                    })}
                  </span>
                ) : (
                  <span>{t("Top tier reached")}</span>
                )}
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                aria-label={t("Membership progress")}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted">
                <span>{t("Basic")}</span>
                <span>{t("Plus")} · 500</span>
                <span>{t("Premium")} · 2,000</span>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              {[
                { label: t("Points earned"), value: transactions.filter((entry) => entry.points > 0).reduce((sum, entry) => sum + entry.points, 0) },
                { label: t("Points redeemed"), value: Math.abs(transactions.filter((entry) => entry.type === "redeem").reduce((sum, entry) => sum + entry.points, 0)) },
                { label: t("Referral code"), value: account.referralCode },
                { label: t("Rewards"), value: rewards.length },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[10px] text-muted">{item.label}</dt>
                  <dd className="mt-1 truncate text-[13px] font-semibold tnum">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="aero-tile rounded-[10px] border p-5">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-brand" />
              <h2 className="text-[13px] font-semibold">{t("Rewards")}</h2>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              {t("Points are not cash. Redeem them at grocery checkout; the server validates every redemption.")}
            </p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {rewards.map((reward) => (
                <li key={reward.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{t(reward.title)}</div>
                    <div className="text-[10px] text-muted">{t(reward.description)}</div>
                  </div>
                  <span className="shrink-0 rounded-[3px] bg-surface-2 px-2 py-1 text-[10px] font-semibold tnum">
                    {reward.pointsCost} pts
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
              <BadgeCheck size={12} className="text-brand" />
              {t("Tier multiplier applied automatically on completed orders.")}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <History size={15} className="text-muted" />
            <h2 className="text-[13px] font-semibold">{t("Points history")}</h2>
          </div>
          <div className="mt-3 divide-y divide-line border-y border-line">
            {transactions.length ? (
              transactions.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold">
                      {t(entry.note || "Points update")}
                    </div>
                    <div className="text-[10px] text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(entry.createdAt))}
                      {" · "}
                      {t("Balance")} {entry.balanceAfter}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-semibold tnum ${
                      entry.points >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {entry.points >= 0 ? "+" : ""}
                    {entry.points}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-[12px] text-muted">
                {t("Your points history will appear here after your first completed order.")}
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3 text-[12px] text-muted">
          <span>{t("No cash value")}</span>
          <span className="text-line-strong">/</span>
          <span>{t("No transfers")}</span>
          <span className="text-line-strong">/</span>
          <span>{t("Server-validated redemption")}</span>
          <span className="text-line-strong">/</span>
          <span>{t("Immutable ledger")}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {t("{points} points ≈ {value}", {
            points: 100,
            value: money(10),
          })}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
