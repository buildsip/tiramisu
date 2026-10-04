import { HomeLayout } from "fumadocs-ui/layouts/home";
import { RiGithubFill } from "@remixicon/react";
import { baseOptions } from "@/lib/layout.shared";
import { docsRoute, gitConfig } from "@/lib/shared";

/** Use Fumadocs navigation options so search and the mobile menu keep working. */
export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout
      {...baseOptions()}
      githubUrl={undefined}
      className="dark bg-black text-neutral-100 [--fd-layout-width:var(--container-7xl)] [--primary:#ededed] [--primary-foreground:#080808] [--border:#242424] [&_#nd-nav]:border-neutral-800 [&_#nd-nav]:bg-black [&_#nd-nav>:first-child]:bg-black [&_#nd-nav_a]:text-sm [&_#nd-nav_a]:text-white [&_#nd-nav_a[href='/']]:text-lg [&_#nd-nav_a.bg-fd-secondary]:rounded-md [&_#nd-nav_a.bg-fd-secondary]:px-4 [&_#nd-nav_a.bg-fd-secondary[href='/docs']]:bg-neutral-100 [&_#nd-nav_a.bg-fd-secondary[href='/docs']]:text-neutral-950 [&_#nd-nav_button]:rounded-md [&_#nd-nav_button]:text-white"
      themeSwitch={{ enabled: false }}
      links={[
        { text: "Docs", url: docsRoute },
        { text: "Features", url: "/#features", active: "none" },
        { text: "Why Git?", url: "/#why-git", active: "none" },
        {
          type: "custom",
          secondary: true,
          children: (
            <a
              href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
            >
              <RiGithubFill className="size-4" aria-hidden /> Star us
            </a>
          ),
        },
        { type: "button", text: "Get started", url: docsRoute, secondary: true },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
