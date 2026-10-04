import Link from "next/link";
import { docsRoute } from "@/lib/shared";
import { MemoryBrowser } from "./memory-browser";
import { PixelSky } from "./pixel-sky";

/** Introduce Tiramisu and let visitors open the example files. */
export function LandingHero() {
  return (
    <section
      className="relative isolate overflow-hidden px-5 pt-16 pb-16 sm:px-8 sm:pt-20"
      aria-labelledby="hero-title"
    >
      <PixelSky />
      {/* Lower the content while the sky stays anchored to the section. */}
      <div className="relative mx-auto max-w-7xl pt-16 lg:pt-20">
        <div className="relative z-10 mx-auto max-w-6xl text-center">
          <h1
            id="hero-title"
            className="font-pixel text-5xl leading-tight font-normal tracking-tight text-balance [-webkit-text-stroke:.015em_currentColor] sm:text-6xl lg:text-7xl"
          >
            Coding agent memory in Git
          </h1>
          <p className="mx-auto mt-6 max-w-2xl w-full text-balance text-base leading-relaxed text-neutral-400 sm:text-lg lg:text-xl">
            Store coding agent{" "}
            <span className="font-medium text-neutral-100">memories as Markdown files</span> inside
            your repository. Use lightweight MCP tools to search and manage memories.
          </p>
          <Link
            href={docsRoute}
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-100 px-6 text-sm font-medium text-neutral-950 transition-colors hover:bg-white"
          >
            Get started
          </Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-10 max-w-5xl">
        <MemoryBrowser />
      </div>
    </section>
  );
}
