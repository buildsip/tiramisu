import Link from "next/link";
import type { ComponentProps } from "react";

/** Next.js link that never prefetches the page it points at. */
export function NoPrefetchLink(props: ComponentProps<typeof Link>) {
  // Set after the spread so a passed-in `prefetch` cannot turn it back on.
  return <Link {...props} prefetch={false} />;
}
