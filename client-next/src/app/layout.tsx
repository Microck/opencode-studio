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
        url: "/logo-dark.png", // Fallback to logo if no OG image
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
    images: ["/logo-dark.png"],
    creator: "@microck",
  },
  icons: {
    icon: "/logo-dark.png",
    apple: "/logo-dark.png",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${rethinkSans.variable} ${geist.variable} ${commitMono.variable} antialiased`}
        suppressHydrationWarning
      >
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
