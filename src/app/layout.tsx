import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/Providers";
import { ThemedToaster } from "@/components/ThemedToaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Every page renders per request so it can carry that request's CSP nonce (src/middleware.ts) -- a
// page prerendered at build time has no nonce and its inline scripts would be blocked.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProdBnb Admin",
  description: "Operational admin panel for the ProdBnb marketplace.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // The init script below sets `class="dark"` before React hydrates -- expected, not a mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browsers hide a nonce from the DOM after parsing, so React would report a mismatch here. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
