import { cn } from "./cn";

/**
 * Renders catalogue and portfolio imagery.
 *
 * Real photography is not wired up yet, so `ph:<domain>:<seed>` tokens render a
 * designed, deterministic tile instead of a broken image. Swapping in real
 * photos later means changing the URLs in the data layer — this component
 * already handles anything that is not a `ph:` token as a normal image.
 */

const domainTint: Record<string, [string, string, string]> = {
  interior: ["#8a6b4f", "#c9b49b", "#efe6da"],
  furniture: ["#7a6a4a", "#c2b189", "#eee8d8"],
  fabrication: ["#5a6472", "#a3adb9", "#e4e8ed"],
  painting: ["#4b6b63", "#9dbdb2", "#e3eeea"],
  default: ["#7c756a", "#b7b0a4", "#eae6de"],
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface MediaProps {
  /** A `ph:domain:seed` token or a normal image URL. */
  src: string;
  alt: string;
  className?: string;
  /** Overlay label drawn on placeholder tiles. */
  label?: string;
  rounded?: boolean;
  priority?: boolean;
}

export function Media({ src, alt, className, label, rounded = true }: MediaProps) {
  const isPlaceholder = src.startsWith("ph:");

  if (!isPlaceholder) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", rounded && "rounded-xl", className)}
      />
    );
  }

  const [, domain = "default", seed = "x"] = src.split(":");
  const [dark, mid, light] = domainTint[domain] ?? domainTint.default;
  const h = hash(seed);
  const angle = 120 + (h % 110);
  const x1 = 18 + (h % 46);
  const y1 = 12 + ((h >> 3) % 50);
  const x2 = 55 + ((h >> 6) % 35);
  const y2 = 60 + ((h >> 9) % 30);
  const variant = h % 3;

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative h-full w-full overflow-hidden",
        rounded && "rounded-xl",
        className,
      )}
      style={{
        background: `linear-gradient(${angle}deg, ${dark} 0%, ${mid} 52%, ${light} 100%)`,
      }}
    >
      {/* Soft light blooms — keeps tiles from reading as flat colour blocks. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 55% at ${x1}% ${y1}%, rgba(255,255,255,0.42), transparent 70%),
                       radial-gradient(45% 45% at ${x2}% ${y2}%, rgba(0,0,0,0.20), transparent 72%)`,
        }}
      />
      {/* A quiet geometric motif, varied by seed. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 200 140"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7">
          {variant === 0 &&
            Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1={i * 24 - 20} y1={-10} x2={i * 24 + 30} y2={150} />
            ))}
          {variant === 1 &&
            Array.from({ length: 5 }, (_, i) => (
              <circle key={i} cx={40 + i * 32} cy={70} r={12 + (i % 3) * 9} />
            ))}
          {variant === 2 &&
            Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={12 + i * 31} y={30 + (i % 2) * 18} width="22" height="60" rx="3" />
            ))}
        </g>
      </svg>
      {label ? (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <span className="inline-block max-w-full truncate rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white backdrop-blur-sm">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
