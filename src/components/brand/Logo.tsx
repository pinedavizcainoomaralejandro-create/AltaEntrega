import Link from "next/link";

/** Marca de AltaEntrega: el sol saliendo sobre las lomas de Villa Altagracia. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" className="fill-monte-700" />
      <circle cx="26" cy="17" r="6" className="fill-sol-400" />
      <path d="M4 31c5-7 9-10 14-10s8 4 12 4 5-2 6-3v14H4z" className="fill-monte-400" />
      <path d="M4 35c6-4 11-6 17-6s10 2 15 1v6H4z" className="fill-monte-200" />
    </svg>
  );
}

export default function Logo({
  href = "/",
  tone = "dark",
}: {
  href?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="AltaEntrega, inicio">
      <LogoMark />
      <span className="leading-none">
        <span
          className={`block font-display text-xl font-semibold tracking-tight ${
            tone === "light" ? "text-white" : "text-stone-900"
          }`}
        >
          AltaEntrega
        </span>
        <span className={`hidden text-[11px] font-medium sm:block ${tone === "light" ? "text-monte-100" : "text-monte-700"}`}>
          Boutiques de Villa Altagracia
        </span>
      </span>
    </Link>
  );
}
