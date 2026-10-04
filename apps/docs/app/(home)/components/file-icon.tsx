import { cn } from "@/lib/cn";

/** Monochrome explorer icons shared by the demo and the feature illustrations. */
export function FileIcon({
  kind = "markdown",
  className,
}: {
  kind?: "folder" | "markdown" | "json" | "image";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
      aria-hidden="true"
    >
      {kind === "folder" && (
        <>
          <path
            d="M2 5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v1H7a3 3 0 0 0-2.8 2L2 16V5Z"
            opacity=".55"
          />
          <path d="M7 9h15a1 1 0 0 1 .95 1.32l-2.5 7.5A2 2 0 0 1 18.55 19H3l3.05-9.32A1 1 0 0 1 7 9Z" />
        </>
      )}
      {kind === "markdown" && (
        <path d="M2 5h3l3 4 3-4h3v14h-3V10l-3 4-3-4v9H2V5Zm16 0h3v9h3l-4.5 5L15 14h3V5Z" />
      )}
      {kind === "json" && (
        <path d="M9 3H6a2 2 0 0 0-2 2v4l-2 3 2 3v4a2 2 0 0 0 2 2h3v-3H7v-4l-1.5-2L7 10V6h2V3Zm6 0h3a2 2 0 0 1 2 2v4l2 3-2 3v4a2 2 0 0 1-2 2h-3v-3h2v-4l1.5-2-1.5-2V6h-2V3Z" />
      )}
      {kind === "image" && (
        <>
          <path
            fillRule="evenodd"
            d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h16V5H4Z"
          />
          <circle cx="8" cy="9" r="2" />
          <path d="m5 17 4-4 3 3 3-5 4 6H5Z" />
        </>
      )}
    </svg>
  );
}
