import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Roamboard home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 38 38" role="presentation">
          <rect width="38" height="38" rx="12" fill="currentColor" opacity="0.08" />
          <path d="M9.2 27.4V10.6h8.6c5.1 0 8.2 2.4 8.2 6.6 0 2.9-1.6 5.1-4.3 6.1L28.4 27.4h-5.4l-6.4-4.8h-3.1v4.8H9.2Zm4.8-8.7h3.3c2.3 0 3.5-.9 3.5-2.6s-1.2-2.5-3.5-2.5h-3.3v5.1Z" />
          <circle cx="29.2" cy="10.4" r="2.7" />
        </svg>
      </span>
      {!compact ? <span className="brand-word">roamboard</span> : <span className="brand-word brand-word-compact">rb</span>}
    </Link>
  );
}
