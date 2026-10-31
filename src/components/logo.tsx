import Link from "next/link";

export function Logo({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Wassl home">
      <span
        className={`grid h-10 w-10 place-items-center rounded-2xl ${
          light ? "bg-white/15 text-on-dark" : "bg-teal text-on-dark"
        } shadow-lg shadow-teal/20`}
      >
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 18.5c2.3-4.1 4.1-4.1 6.1-1.2 1.9 2.7 3.6 2.5 5.1-.5 1-2.1 2.2-2.9 3.3-3.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 4"
          />
          <circle cx="5" cy="18.5" r="2.4" fill="currentColor" />
          <path
            d="M14.6 3.8c2.2 0 3.9 1.7 3.9 3.8 0 3-3.9 6.3-3.9 6.3s-3.8-3.3-3.8-6.3c0-2.1 1.7-3.8 3.8-3.8Z"
            fill="currentColor"
          />
          <circle cx="14.6" cy="7.6" r="1.3" fill={light ? "#0f6e6e" : "#f7f3eb"} />
        </svg>
      </span>
      {!compact ? (
        <span className="flex items-baseline gap-2">
          <span
            className={`text-[21px] font-extrabold tracking-[-0.06em] ${
              light ? "text-on-dark" : "text-ink"
            }`}
          >
            Wassl
          </span>
          <span
            className={`arabic text-[15px] font-semibold ${
              light ? "text-on-dark/70" : "text-teal"
            }`}
          >
            وصّل
          </span>
        </span>
      ) : null}
    </Link>
  );
}
