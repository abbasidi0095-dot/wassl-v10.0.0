"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import type { Session } from "@/lib/types";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function StaffHeader({
  session,
  links,
  title,
  subtitle,
  accent = "teal",
}: {
  session: Session;
  links: { href: string; label: string }[];
  title: string;
  subtitle: string;
  accent?: "teal" | "saffron" | "ink";
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-cream/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="container-wassl flex h-[66px] items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo compact />
          <div className="hidden border-s border-ink/10 ps-3 sm:block">
            <div className="text-[12px] font-extrabold leading-4">{title}</div>
            <div className="text-[9px] font-bold text-ink/35">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-ink/5 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-ink/50 md:block">
            {session.role}
          </span>
          <Link
            href="/"
            className="hidden items-center gap-1 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 text-[10px] font-extrabold text-ink/55 hover:text-ink sm:flex"
          >
            Customer site <ArrowUpRight size={12} />
          </Link>
          <div className="hidden text-end sm:block">
            <div className="text-[11px] font-extrabold leading-4">{session.name}</div>
            <div className="text-[9px] text-ink/35">On shift</div>
          </div>
          <ThemeToggle className="h-9 w-9" />
          <button
            type="button"
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 bg-white/60 text-ink/45 hover:text-red-500"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
      <div className="container-wassl pb-2">
        <nav className="staff-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={pathname === link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div
        className={`h-[2px] w-full ${
          accent === "saffron"
            ? "bg-saffron"
            : accent === "ink"
              ? "bg-ink"
              : "bg-teal"
        } opacity-60`}
      />
    </header>
  );
}
