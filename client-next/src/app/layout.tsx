import type { Metadata } from "next";
import { Rethink_Sans, Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PendingActionDialog } from "@/components/pending-action-dialog";

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink-sans",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const commitMono = localFont({
  src: [
    { path: "../../public/fonts/CommitMono-400-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/CommitMono-400-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/CommitMono-700-Regular.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/CommitMono-700-Italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-commit-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://opencode.micr.dev"),
  title: {
    default: "OpenCode Studio - AI Configuration Manager",
    template: "%s | OpenCode Studio",
  },
  description:
    "Visual interface for managing your OpenCode configuration. Configure MCP servers, skills, plugins, and AI agents with a modern dashboard.",
  keywords: [
    "OpenCode",
    "AI",
    "LLM",
    "Configuration",
    "MCP",
    "Model Context Protocol",
    "Skills",
    "Plugins",
    "Agents",
    "Developer Tools",
  ],
  authors: [{ name: "Microck", url: "https://github.com/Microck" }],
  creator: "Microck",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://opencode.micr.dev",
    title: "OpenCode Studio - AI Configuration Manager",
    description:
      "Visual interface for managing your OpenCode configuration. Configure MCP servers, skills, plugins, and AI agents with a modern dashboard.",
    siteName: "OpenCode Studio",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "OpenCode Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenCode Studio - AI Configuration Manager",
    description:
      "Visual interface for managing your OpenCode configuration. Configure MCP servers, skills, plugins, and AI agents with a modern dashboard.",
    images: ["/og.jpg"],
    creator: "@microck",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "theme-color": "#111111",
    "color-scheme": "dark light",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "OpenCode Studio",
    description:
      "Visual interface for managing OpenCode configuration. Configure MCP servers, skills, plugins, and AI agents.",
    url: "https://opencode.micr.dev",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    author: {
      "@type": "Person",
      name: "Microck",
      url: "https://github.com/Microck",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${rethinkSans.variable} ${geist.variable} ${commitMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:border focus:border-border focus:rounded"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AppProvider>
            <AppShell>
              {children}
            </AppShell>
            <PendingActionDialog />
            <Toaster />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
