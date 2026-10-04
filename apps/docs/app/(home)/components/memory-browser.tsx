"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { ArrowUpRight } from "lucide-react";
import hydrationImage from "@/public/hydration-error.png";
import { FileIcon } from "./file-icon";

// Complete example files, not live project data. Switching a file never touches disk.
const memories = {
  types: {
    path: ".memories/generate-types-from-the-spec/memory.md",
    content: `---
id: 8ef26da2-2158-49a3-9c6f-52914ca3c651
created: 2026-09-17
title: Generate types from the spec
scope:
  - apps/web
  - apps/api
doNotDelete: true
---

The frontend contained hand-written types that had not been updated in a while, and some new features relied on them instead of the types generated from the API's OpenAPI schema. TypeScript types are now generated with Orval, and the generated models replace the hand-written API interfaces, which are deprecated.

Generating the HTTP getters and actions with the same tool is deferred, and will be tested first in new features under development to find edge cases before wider adoption. A single generated definition reduces duplication and inconsistency, and Orval supports \`anyOf\` and \`oneOf\`, which the previous generator did not.

Two alternatives were rejected. \`@openapitools/openapi-generator\` offers fewer customization options and has trouble with \`anyOf\` and \`oneOf\`, and \`@openapi-codegen\` does not generate SWR hooks. Because every change to the specification is reflected in the generated SDK, the API's OpenAPI specification must be kept up to date.`,
  },
  schemas: {
    path: ".memories/split-request-response-schemas/memory.md",
    content: `---
id: b7e35912-d6d7-48b4-9a0a-8a41cc7546c2
created: 2026-09-22
title: Split request/response schemas
scope:
  - apps/web
  - apps/api
---

A single schema was reused for both requests and responses, which made schemas too broad for responses and too strict for requests. Request and response schemas are now defined separately, so responses are precise and constrained while requests are more permissive.

Separate schemas give each direction an exact structure, which reduces undefined values and the need to reshape incoming requests before handling them. They can also be changed independently with less risk of side effects, and they allow validation or transformation specific to each direction later.

The cost is that two sets of schemas must be maintained, and fields shared by both are duplicated. Without careful synchronization, the two can become inconsistent. There is no bulk replacement. Schemas are separated whenever the code that uses them is modified, with completion targeted for a set major release.`,
  },
  hydration: {
    path: "apps/web/.memories/errors/hydration-mismatch/memory.md",
    content: `---
id: 7fe24e91-4808-4f80-bc39-5d86f7a74be0
created: 2026-09-19
title: Hydration mismatch
---

This error occurs when the React tree prerendered on the server differs from the tree produced by the first render in the browser. The cause is not always in the component code. Browser extensions that modify the HTML and misconfigured CSS-in-JS libraries can trigger it. So can edge or CDN features that alter the HTML response, such as Cloudflare Auto Minify.

iOS can also convert phone numbers and email addresses into links, which changes the HTML. A meta tag that disables telephone, date, email and address detection prevents this. Code-level causes include invalid nesting of interactive elements and content that differs by nature between server and client, such as a timestamp.

Each fix has a different trade-off. Rendering identical content on both sides is preferred. Content that must differ is rendered on the client through \`useEffect\`. Prerendering can be disabled for a specific component. For unavoidable differences, \`suppressHydrationWarning={true}\` suppresses the warning, but React does not patch the mismatched text, so the server's version stays in place.`,
  },
  models: {
    path: "apps/api/.memories/read-and-write-models/memory.md",
    content: `---
id: a8f74e31-4b67-42af-8f12-d752302bf0d6
created: 2026-09-21
title: Read and write models
---

Each business module used one service-plus-store pattern for three tasks: changing state, supplying UI data, and answering questions from other modules. That was convenient and kept the number of building blocks small, but it coupled services and gave stores too many responsibilities. Every need is now classified as one of three models.

State changes use the write model. Workflow logic lives in the application service, which delegates to a domain model only for complex subdomains, and the store provides generic CRUD only.

Data for UI display comes from an external read model that returns everything a screen needs in one query, typically joining several tables. The frontend then does not query multiple write models, and stores stay generic.

Information needed from another module comes from an internal read model. It is narrowly focused, answers one question with a simple query, and is not exposed to the UI. As a result, other modules do not depend on a module's service, store or write model, and cannot call its write methods by accident.`,
  },
};

// Attachments use the same preview as memories, but are not indexed during search.
const files = {
  ...memories,
  image: {
    path: "apps/web/.memories/errors/hydration-mismatch/hydration-error.png",
    src: hydrationImage,
    alt: "Next.js console error showing a hydration mismatch between server and client HTML.",
  },
};

type FileId = keyof typeof files;
type Entry = {
  name: string;
  depth: number;
  kind: "folder" | "markdown" | "image";
  label?: "package";
  file?: FileId;
};

// Keep complete classes here so Tailwind can discover every indentation level.
const depths = ["pl-2", "pl-6", "pl-10", "pl-14", "pl-18", "pl-22"];
const row =
  "group flex min-h-8 w-full items-center gap-2 rounded border border-transparent py-1 pr-2 text-xs leading-5 whitespace-nowrap text-neutral-400";
// Label the boundaries without relying on language-specific manifest filenames.
const badge =
  "shrink-0 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-sans text-[10px] leading-3 text-neutral-400";
const entries: Entry[] = [
  { name: ".memories", depth: 0, kind: "folder" },
  { name: "generate-types-from-the-spec", depth: 1, kind: "folder" },
  { name: "memory.md", depth: 2, kind: "markdown", file: "types" },
  { name: "split-request-response-schemas", depth: 1, kind: "folder" },
  { name: "memory.md", depth: 2, kind: "markdown", file: "schemas" },
  { name: "apps", depth: 0, kind: "folder" },
  { name: "web", depth: 1, kind: "folder", label: "package" },
  { name: ".memories", depth: 2, kind: "folder" },
  { name: "errors", depth: 3, kind: "folder" },
  { name: "hydration-mismatch", depth: 4, kind: "folder" },
  { name: "memory.md", depth: 5, kind: "markdown", file: "hydration" },
  { name: "hydration-error.png", depth: 5, kind: "image", file: "image" },
  { name: "api", depth: 1, kind: "folder", label: "package" },
  { name: ".memories", depth: 2, kind: "folder" },
  { name: "read-and-write-models", depth: 3, kind: "folder" },
  { name: "memory.md", depth: 4, kind: "markdown", file: "models" },
];

/** Adds restrained syntax color without parsing or injecting HTML from the example. */
function MemoryLine({ line, frontmatter }: { line: string; frontmatter: boolean }) {
  if (line === "---") return <span className="text-neutral-500">{line}</span>;
  if (frontmatter) {
    const colon = line.indexOf(":");
    if (colon !== -1)
      return (
        <>
          <span className="text-amber-100/80">{line.slice(0, colon + 1)}</span>
          {line.slice(colon + 1)}
        </>
      );
  }
  return <>{line || "\u00a0"}</>;
}

/** File buttons switch the preview; folder rows only show the repository structure. */
export function MemoryBrowser() {
  const [selected, setSelected] = useState<FileId>("types");
  const file = files[selected];
  const name = file.path.split("/").at(-1)!;
  const kind = "src" in file ? "image" : "markdown";
  // Image attachments have no text content to split into numbered lines.
  const lines = "content" in file ? file.content.split("\n") : [];
  const frontmatterEnd = lines.indexOf("---", 1);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 text-left font-mono shadow-2xl ring-4 ring-white/5">
      <div className="grid lg:grid-cols-3">
        <div className="min-w-0 border-b border-neutral-800 bg-neutral-950 py-4 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2 px-4 pb-3 text-xs text-neutral-200">
            <span>acme-app</span>
            <span className={badge}>monorepo</span>
          </div>
          <ul aria-label="Example repository files" className="overflow-x-auto px-2">
            {entries.map((entry, index) => {
              const content = (
                <>
                  <FileIcon kind={entry.kind} className="size-3.5" />
                  <span>{entry.name}</span>
                  {entry.label && <span className={badge}>{entry.label}</span>}
                  {entry.file && (
                    <span
                      className="ml-auto flex items-center gap-1 pl-1 text-xs text-neutral-500 group-hover:text-white group-focus-visible:text-white"
                      aria-hidden
                    >
                      {entry.file === selected ? "" : "Open"}
                      <ArrowUpRight className="size-3" />
                    </span>
                  )}
                </>
              );
              return (
                <li key={index}>
                  {entry.file ? (
                    <button
                      type="button"
                      className={cn(
                        row,
                        depths[entry.depth],
                        "cursor-pointer text-neutral-100 transition-colors hover:bg-neutral-800 focus-visible:bg-neutral-800",
                        entry.file === selected && "border-neutral-700 bg-neutral-800",
                      )}
                      aria-label={`Open ${files[entry.file].path}`}
                      aria-pressed={selected === entry.file}
                      onClick={() => {
                        if (entry.file) setSelected(entry.file);
                      }}
                    >
                      {content}
                    </button>
                  ) : (
                    <span className={cn(row, depths[entry.depth])}>{content}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {/* Keep the preview height stable when switching between files. */}
        <div
          className="flex h-108 min-w-0 flex-col overflow-hidden md:h-140 lg:col-span-2 lg:h-152"
          id="memory-preview"
          role="region"
          aria-label={`Preview of ${file.path}`}
        >
          <div className="flex h-11 shrink-0 items-stretch border-b border-neutral-800 text-xs text-neutral-400">
            <span className="-mt-px flex items-center gap-2 border-t border-t-neutral-200 border-r border-r-neutral-800 px-4 text-neutral-200">
              <FileIcon kind={kind} className="size-3.5" />
              {name}
            </span>
          </div>
          {/* Remount the scroll area for each file so its preview starts at the top. */}
          <div key={selected} className="min-h-0 flex-1 overflow-auto" tabIndex={0}>
            {"src" in file ? (
              // Fit the full screenshot in the preview without cropping or stretching it.
              <div className="flex h-full items-center justify-center p-4">
                <Image
                  src={file.src}
                  alt={file.alt}
                  sizes="(min-width: 1024px) 640px, 100vw"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <pre className="m-0 min-h-full py-4 pr-4 text-xs leading-6 whitespace-pre-wrap text-neutral-300">
                <code>
                  {lines.map((line, index) => (
                    <span className="flex" key={`${selected}-${index}`}>
                      <span
                        className="w-10 shrink-0 pr-3 text-right text-neutral-600 select-none"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 wrap-anywhere">
                        <MemoryLine line={line} frontmatter={index < frontmatterEnd} />
                      </span>
                    </span>
                  ))}
                </code>
              </pre>
            )}
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        Showing {file.path}
      </span>
    </div>
  );
}
