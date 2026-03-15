import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  /** Height in pixels — icon and text scale together */
  size?: "sm" | "md" | "lg";
  /** Show wordmark text alongside icon */
  showText?: boolean;
  /** Link to homepage when clicked */
  asLink?: boolean;
  /** Additional classes on the wrapper */
  className?: string;
}

const SIZES = {
  sm: { icon: 24, text: "text-base" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 40, text: "text-2xl" },
} as const;

export function Logo({
  size = "md",
  showText = true,
  asLink = true,
  className = "",
}: LogoProps) {
  const { icon, text } = SIZES[size];

  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/assets/icon.png"
        alt=""
        width={icon}
        height={icon}
        className="rounded-md"
        priority
      />
      {showText && (
        <span
          className={`font-heading ${text} font-bold tracking-tight text-brand`}
        >
          ZAXVIO
        </span>
      )}
    </span>
  );

  if (asLink) {
    return <Link href="/">{content}</Link>;
  }

  return content;
}
