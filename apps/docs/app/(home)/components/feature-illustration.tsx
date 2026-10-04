import { Search, Check, Clock3 } from "lucide-react";
import { FileIcon } from "./file-icon";
import { cn } from "@/lib/cn";

const art =
  "relative h-60 overflow-hidden bg-[radial-gradient(ellipse_at_50%_70%,#151515_0%,#020202_68%)] font-mono";
const ghost = "flex h-7 items-center gap-2.5 px-5 py-1 text-neutral-500 opacity-50";
const note =
  "flex items-center gap-3 rounded-md border border-neutral-700 bg-[linear-gradient(130deg,#202020,#0b0b0b)] px-3.5 py-3 text-[9px] [&>svg:last-child]:ml-auto";
const node =
  "absolute z-10 flex h-8 w-28 items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 text-xs text-neutral-400";

/** Native HTML and SVG keep the diagrams sharp at every size and easy to change. */
export function FeatureIllustration({ kind }: { kind: "search" | "pruning" | "scope" }) {
  if (kind === "search")
    return (
      <div className={cn(art, "px-6 pt-10")} data-illustration aria-hidden>
        <div className="relative mx-auto max-w-72 rounded-lg border border-neutral-700 bg-[linear-gradient(130deg,#181818,#090909)] shadow-[0_15px_30px_#000] [transform:perspective(600px)_rotateY(-9deg)_rotateX(5deg)]">
          <div className="flex items-center gap-2.5 border-b border-neutral-700 px-3 py-3 text-xs text-neutral-300">
            <Search size={14} className="text-neutral-500" />
            <span>cache is stale</span>
            <kbd className="ml-auto size-4 rounded border border-neutral-700 text-center text-neutral-500">
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
            <span className="text-[7px] text-neutral-400">0.98</span>
          </div>
          {[0, 1].map((row) => (
            <div key={row} className={ghost}>
              <FileIcon />
              <i className="h-1 w-20 rounded-xs bg-neutral-800" />
              <i className="ml-auto h-1 w-6 rounded-xs bg-neutral-800" />
            </div>
          ))}
        </div>
      </div>
    );

  if (kind === "pruning")
    return (
      <div className={cn(art, "px-8 pt-11 pb-5")} data-illustration aria-hidden>
        <div className="absolute right-8 bottom-12 left-8 border-t border-dashed border-neutral-700" />
        <div className="relative mx-auto max-w-64">
          <div className={cn(note, "translate-x-2 -rotate-5 opacity-50")}>
            <FileIcon />
            <span>old-workaround.md</span>
            <Clock3 size={13} />
          </div>
          <div
            className={cn(
              note,
              "relative z-1 -mt-0.5 border-neutral-600 text-neutral-300 shadow-[0_3px_30px_#000]",
            )}
          >
            <FileIcon />
            <span>useful-context.md</span>
            <Check size={14} />
          </div>
          <div className={cn(note, "-mt-0.5 -translate-x-1.5 rotate-4 opacity-25")}>
            <FileIcon />
            <span>outdated-decision.md</span>
            <Clock3 size={13} />
          </div>
        </div>
        <div className="relative mx-auto mt-6 flex max-w-72 justify-between text-[6px] tracking-[.9px] text-neutral-600">
          <span>CREATED</span>
          <span>UPVOTED</span>
          <span>REVIEW</span>
        </div>
      </div>
    );

  return (
    <div className={art} data-illustration aria-hidden>
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
        <div className={cn(node, "top-8 left-1/2 -translate-x-1/2")}>
          <span>acme-app</span>
        </div>
        <div className={cn(node, "top-32 left-2")}>
          <FileIcon kind="folder" />
          <span>apps/web</span>
        </div>
        <div className={cn(node, "top-32 right-2 border-neutral-800 text-neutral-600")}>
          <FileIcon kind="folder" />
          <span>apps/api</span>
        </div>
        <div className={cn(node, "top-48 left-2 h-7 border-neutral-500 text-neutral-200")}>
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
