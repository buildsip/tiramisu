"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ComponentProps } from "react";
import { NoPrefetchLink } from "@/components/no-prefetch-link";

type Props = ComponentProps<typeof RootProvider>;
// Fumadocs' link type marks `href` as optional. Next.js requires one.
type FumadocsLinkProps = ComponentProps<"a"> & { prefetch?: boolean };

/** Use the no-prefetch link for internal routes. Leave a plain anchor when there is no href. */
function FumadocsLink({ href, ...props }: FumadocsLinkProps) {
  if (typeof href !== "string") return <a href={href} {...props} />;
  return <NoPrefetchLink href={href} {...props} />;
}

/**
 * Fumadocs renders its own links (nav, sidebar, cards, markdown).
 * Those go through this provider, so they use the same no-prefetch link.
 */
export function DocsProvider({ components, children, ...props }: Props) {
  return (
    <RootProvider {...props} components={{ ...components, Link: FumadocsLink }}>
      {children}
    </RootProvider>
  );
}
