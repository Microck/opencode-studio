import type { Metadata } from "next";
import Script from "next/script";
import { Rethink_Sans, Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PendingActionDialog } from "@/components/pending-action-dialog";
import { GrabToggle } from "@/components/grab-toggle";

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
  title: "Opencode Studio",
  description: "Manage your Opencode configuration",
  icons: {
    icon: "/logo-dark.png",
    apple: "/logo-dark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="//unpkg.com/react-grab/dist/index.global.js"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <Script
          src="//unpkg.com/@react-grab/opencode/dist/client.global.js"
          strategy="lazyOnload"
        />
      </head>
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
            <GrabToggle />
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
