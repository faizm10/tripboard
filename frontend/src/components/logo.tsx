import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Tripboard home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 38 38" role="presentation">
          <rect width="38" height="38" rx="12" fill="currentColor" opacity="0.08" />
          <path d="M8 10.6h22v4.5h-8.4v12.3h-5.2V15.1H8v-4.5Z" />
          <circle cx="29.2" cy="10.4" r="2.7" />
        </svg>
      </span>
      {!compact ? <span className="brand-word">tripboard</span> : <span className="brand-word brand-word-compact">tb</span>}
    </Link>
  );
}
