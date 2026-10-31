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

  const roleLabel =
    session.role === "merchant"
      ? "Store workspace"
      : session.role === "driver"
        ? "Driver workspace"
        : "Operations";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)]">
      <div className="container-wassl flex h-14 items-center justify-between gap-3 lg:h-16">
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact />
          <div className="min-w-0 border-s border-line ps-3">
            <div className="truncate text-[12px] font-semibold leading-4">
              {title}
            </div>
            <div className="truncate text-[10px] leading-4 text-muted">
              {subtitle}
            </div>
          </div>
          <span className="hidden rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted md:inline">
            {roleLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="hidden items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:flex"
          >
            Customer site <ArrowUpRight size={12} />
          </Link>
          <div className="hidden text-end sm:block">
            <div className="text-[11px] font-medium leading-4">{session.name}</div>
            <div className="text-[10px] leading-4 text-muted">
              {session.role === "driver" ? "On shift" : "Signed in"}
            </div>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-danger"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="container-wassl">
        <nav className="staff-nav -mb-px gap-1 pb-0" aria-label="Workspace">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={pathname === link.href}
              className="!rounded-none !border-b-2 !border-transparent !px-1.5 !pb-2.5 !pt-1 data-[active=true]:!border-brand data-[active=true]:!bg-transparent data-[active=true]:!text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
