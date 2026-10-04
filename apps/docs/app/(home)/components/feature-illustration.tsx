import { Search, Check, Clock3, Trash2 } from "lucide-react";
import { FileIcon } from "./file-icon";
import { cn } from "@/lib/cn";

const art = "relative isolate h-60 overflow-hidden bg-transparent font-mono";

/**
 * Dotted grid behind each drawing.
 * Cells are 16px. Each line is a 1px dash, then a 1px gap, in white at 8% opacity.
 * The horizontal line sits near the bottom of each cell, and the pattern is
 * aligned to the bottom of the box, so that last line stays on screen.
 */
const gridSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M0 15H16M.5 0V16' stroke='white' stroke-opacity='0.08' stroke-dasharray='1 1'/></svg>";

function IllustrationGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(gridSvg)}")`,
        backgroundSize: "16px 16px",
        backgroundPosition: "left bottom",
      }}
    />
  );
}
const ghost = "flex h-7 items-center gap-2.5 px-5 py-1 text-neutral-500 opacity-50";
const note =
  "flex items-center gap-2.5 rounded-md border border-neutral-700 bg-[linear-gradient(130deg,#202020,#0b0b0b)] px-3.5 py-3 text-[11px] text-neutral-500 [&>svg:last-child]:ml-auto";
const node =
  "absolute z-10 flex h-8 w-28 items-center justify-center gap-2 rounded-md border bg-neutral-950 text-xs";
/** In-scope nodes use the kept memory from the pruning diagram: same border, fill, and icon color. */
const kept = "border-neutral-700 bg-[linear-gradient(130deg,#202020,#0b0b0b)] text-neutral-300";

/** Native HTML and SVG keep the diagrams sharp at every size and easy to change. */
export function FeatureIllustration({ kind }: { kind: "search" | "pruning" | "scope" }) {
  if (kind === "search")
    return (
      <div className={cn(art, "px-6 pt-10")} data-illustration aria-hidden>
        <IllustrationGrid />
        <div className="relative mx-auto max-w-72 rounded-lg border border-neutral-700 bg-[linear-gradient(130deg,#181818,#090909)] shadow-[0_15px_30px_#000]">
          <div className="flex items-center gap-2.5 border-b border-neutral-700 px-3 py-3 text-xs text-neutral-300">
            <Search size={14} className="text-neutral-500" />
            <span>cache is stale</span>
            <kbd className="ml-auto flex size-4 items-center justify-center rounded border border-neutral-700 leading-none text-neutral-500">
              ↵
            </kbd>
          </div>
          <div className="mx-2 mt-2 flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 p-2 text-neutral-400">
            <FileIcon />
            <div className="flex-1 text-[8px] [&_mark]:bg-[#3a3a3a] [&_mark]:text-neutral-100">
              <span>
                Next.js <mark>cache</mark> <mark>is stale</mark>
              </span>
              <small className="mt-1 block text-[7px] text-neutral-500">
                apps/web/.memories/errors
              </small>
            </div>
          </div>
          {[0, 1].map((row) => (
            <div key={row} className={ghost}>
              <FileIcon />
              <i className="h-1 w-20 rounded-xs bg-neutral-800" />
            </div>
          ))}
        </div>
      </div>
    );

  if (kind === "pruning")
    return (
      <div className={cn(art, "flex items-center px-7")} data-illustration aria-hidden>
        <IllustrationGrid />
        {/* Top to bottom: deleted, expiring, and kept. */}
        <div className="mx-auto flex w-full max-w-72 flex-col gap-2.5">
          <div className={note}>
            <FileIcon className="text-red-200/70" />
            <span className="min-w-0 flex-1 truncate text-red-200/70 line-through">
              outdated-decision.md
            </span>
            <Trash2 size={13} className="text-red-200/70" />
          </div>
          <div className={note}>
            <FileIcon className="text-amber-200/70" />
            <span className="min-w-0 flex-1 truncate text-amber-200/70">old-workaround.md</span>
            <Clock3 size={13} className="text-amber-200/70" />
          </div>
          <div className={cn(note, "text-neutral-300")}>
            <FileIcon />
            <span className="min-w-0 flex-1 truncate">useful-context.md</span>
            <Check size={14} />
          </div>
        </div>
      </div>
    );

  return (
    <div className={art} data-illustration aria-hidden>
      <IllustrationGrid />
      <div className="relative mx-auto h-60 w-80">
        {/* Each segment ends at a node edge; opaque nodes also prevent lines bleeding through. */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 320 240" fill="none">
          <path
            d="M160 64v40M64 128v-24h192v24M64 160v32m192-32v32"
            stroke="currentColor"
            className="text-neutral-800"
          />
          <path
            d="M160 64v40H64v24M64 160v32"
            stroke="currentColor"
            className="text-neutral-400"
            strokeDasharray="3 4"
          />
        </svg>
        <div className={cn(node, kept, "top-8 left-1/2 -translate-x-1/2")}>
          <span>acme-app</span>
        </div>
        <div className={cn(node, kept, "top-32 left-2")}>
          <FileIcon kind="folder" />
          <span>apps/web</span>
        </div>
        <div className={cn(node, "top-32 right-2 border-neutral-800 text-neutral-600")}>
          <FileIcon kind="folder" />
          <span>apps/api</span>
        </div>
        <div className={cn(node, kept, "top-48 left-2 h-7")}>
          <FileIcon className="size-3.5" />
          <span>memory.md</span>
        </div>
        <div className={cn(node, "top-48 right-2 h-7 border-neutral-800 text-neutral-600")}>
          <FileIcon className="size-3.5" />
          <span>memory.md</span>
        </div>
      </div>
    </div>
  );
}
