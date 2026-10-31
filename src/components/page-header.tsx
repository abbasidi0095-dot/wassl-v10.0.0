import type { ReactNode } from "react";

/**
 * Shared page opener: a quiet label, one display heading, a short description
 * and optional actions. Keeps every customer page on the same grid.
 */
export function PageHeader({
  label,
  title,
  description,
  actions,
  children,
}: {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line pb-6 pt-8 lg:pb-8 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {label ? (
            <p className="text-[13px] font-medium text-muted">{label}</p>
          ) : null}
          <h1 className="display mt-2 text-[clamp(2rem,1.5rem+1.8vw,3rem)]">
            {title}
          </h1>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-3 max-w-[62ch] text-[14px] leading-6 text-muted">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}
