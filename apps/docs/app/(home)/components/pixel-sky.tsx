import { cn } from "@/lib/cn";

// Fixed positions keep the server and browser output identical during hydration.
const stars = [
  "left-[7%] top-24",
  "left-[18%] top-54 opacity-65 max-sm:hidden",
  "left-[29%] top-20 opacity-60 max-sm:hidden",
  "left-[44%] top-8 opacity-40",
  "left-[64%] top-26 opacity-40",
  "left-[76%] top-16 opacity-65 max-sm:hidden",
  "left-[92%] top-52 max-sm:hidden",
  "left-[85%] top-88 opacity-40",
  "left-[5%] top-104 opacity-60 max-sm:hidden",
  "left-[96%] top-132 opacity-45",
  "left-[11%] top-180 opacity-30",
  "left-[89%] top-208 opacity-30 max-sm:hidden",
];

/** Small, crisp SVG pixels decorate the hero without a grid or a painted backdrop. */
export function PixelSky() {
  return (
    <div className="pointer-events-none absolute inset-0 text-neutral-500" aria-hidden>
      {stars.map((position, index) => (
        <svg
          key={index}
          className={cn("absolute", position)}
          width={index % 3 === 0 ? 15 : 9}
          height={index % 3 === 0 ? 15 : 9}
          viewBox="0 0 5 5"
          fill="currentColor"
          shapeRendering="crispEdges"
        >
          <path d="M2 0h1v2h2v1H3v2H2V3H0V2h2z" />
        </svg>
      ))}
      <svg
        className="absolute top-24 right-[10%] size-10 -rotate-12 text-neutral-400 max-xl:top-16 max-xl:right-[6%] max-xl:size-8 max-sm:top-7 max-sm:right-[9%] max-sm:size-6"
        viewBox="0 0 12 12"
        fill="currentColor"
        shapeRendering="crispEdges"
      >
        <path d="M5 0h3v1H6v2H5v4h1v2h2v1h3v1H9v1H4v-1H2V9H1V7H0V4h1V2h2V1h2z" />
        <path d="M2 4h1v2H2zm2 4h1v1H4z" fill="#555" />
      </svg>
    </div>
  );
}
