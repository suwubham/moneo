import type { Metadata, Viewport } from "next";
import { ThemeScript, themeColors } from "@moneo/ui/theme";
import { fontVars } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_SITE_URL || "http://localhost:3030"),
  title: { default: "Moneo — your money, explained", template: "%s · Moneo" },
  description: "Accounts, transactions and budgets, with an assistant that can answer questions about your own money.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: themeColors,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
