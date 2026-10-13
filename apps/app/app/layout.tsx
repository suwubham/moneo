import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { ThemeScript, themeColors } from "@moneo/ui/theme";
import { fontVars } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Moneo", template: "%s · Moneo" },
  description: "Your accounts, transactions and budgets, with an assistant that knows your numbers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: themeColors,
  viewportFit: "cover",
};

// Colours come from --clerk-* variables in globals.css: Clerk defines its own --accent, so var(--accent) here resolves to nothing.
const appearance = {
  cssLayerName: "clerk",
  variables: { fontFamily: "var(--font-bricolage), system-ui, sans-serif", borderRadius: "0.9rem" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ClerkProvider appearance={appearance} afterSignOutUrl={process.env.APP_SITE_URL || "/sign-in"}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
