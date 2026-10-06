import { DocsProvider } from "@/components/docs-provider";
import "./global.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Geist_Pixel } from "next/font/google";
import Script from "next/script";
import { siteUrl } from "@/lib/shared";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Next has no fallback metrics for Geist Pixel, so use an unadjusted monospace fallback.
const geistPixel = Geist_Pixel({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-geist-pixel",
  adjustFontFallback: false,
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tiramisu",
    template: "%s | Tiramisu",
  },
  description: "Coding agent memory in Git",
  icons: {
    icon: "/logo.ico",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        geist.variable,
        geistMono.variable,
        geistPixel.variable,
        "overscroll-none bg-black font-sans",
      )}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col overscroll-none">
        <DocsProvider>{children}</DocsProvider>
        {process.env.NEXT_PUBLIC_ENV === "production" ? (
          <Script
            strategy="afterInteractive"
            src="https://cloud.umami.is/script.js"
            data-website-id="805e02f7-3da5-44db-91e6-a91081401370"
          />
        ) : null}
      </body>
    </html>
  );
}
