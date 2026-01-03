import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PendingActionDialog } from "@/components/pending-action-dialog";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
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
    icon: "/opencode-logo.png",
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
        className={`${spaceGrotesk.variable} ${commitMono.variable} antialiased`}
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
