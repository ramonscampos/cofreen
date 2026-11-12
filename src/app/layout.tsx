import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/providers/service-worker-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cofreen",
  description: "Organize suas finanças de forma simples e eficiente.",
  applicationName: "Cofreen",
  appleWebApp: {
    capable: true,
    title: "Cofreen",
    // The header is dark, so the status bar can sit translucent over it
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#121214",
  width: "device-width",
  initialScale: 1,
  // Lets the page draw under the notch; safe-area insets keep content clear
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          richColors
          theme="dark"
          offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
          mobileOffset={{
            top: "calc(env(safe-area-inset-top) + 16px)",
            left: "16px",
            right: "16px",
          }}
        />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
