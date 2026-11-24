import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: { default: "TransfertPro", template: "%s · TransfertPro" },
  description: "Gestion des transferts d'argent multi-devises",
  // Outil interne : rien à indexer.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-white font-sans text-gray-800">
        {/* Même format téléphone sur tous les écrans. */}
        <div className="relative mx-auto min-h-screen max-w-md bg-gray-50 shadow-lg print:max-w-none print:shadow-none">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
