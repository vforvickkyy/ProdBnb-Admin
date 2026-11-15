import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Every page renders per request so it can carry that request's CSP nonce (src/middleware.ts) -- a
// page prerendered at build time has no nonce and its inline scripts would be blocked.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProdBnb Admin",
  description: "Operational admin panel for the ProdBnb marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
