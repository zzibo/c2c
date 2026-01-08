import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ToastProvider } from "@/lib/toast/ToastContext";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { AppStoreProvider } from "@/lib/store/AppStore";
import { AppHeader } from "@/components/layout/AppHeader";
import { WelcomeBackHandler } from "@/components/auth/WelcomeBackHandler";

// Roboto Mono font setup
const robotoMono = localFont({
  src: [
    {
      path: '../public/font/RobotoMono-VariableFont_wght.ttf',
      weight: '100 700',
      style: 'normal',
    },
    {
      path: '../public/font/RobotoMono-Italic-VariableFont_wght.ttf',
      weight: '100 700',
      style: 'italic',
    },
  ],
  variable: '--font-roboto-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "C2C - Cafe to Code",
  description: "Discover the best cafes for coding and remote work",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={robotoMono.variable}>
      <head>
        <link rel="icon" href="/assets/c2c-icon.webp" type="image/webp" />
        {/* Preload critical images */}
        <link rel="preload" href="/assets/c2c-icon.webp" as="image" />
        <link rel="preload" href="/assets/full_star.webp" as="image" />
        <link rel="preload" href="/assets/half_star.webp" as="image" />
        <link rel="preload" href="/assets/zero_star.webp" as="image" />
        <link rel="preload" href="/assets/cafe-icon.webp" as="image" />
        <link rel="preload" href="/assets/coffee.webp" as="image" />
        <link rel="preload" href="/assets/vibes.webp" as="image" />
        <link rel="preload" href="/assets/wifi.webp" as="image" />
        <link rel="preload" href="/assets/plugs.webp" as="image" />
        <link rel="preload" href="/assets/seats.webp" as="image" />
        <link rel="preload" href="/assets/noise.webp" as="image" />
      </head>
      <body className={robotoMono.className}>
        <QueryProvider>
          <AuthProvider>
            <AppStoreProvider>
              <ToastProvider>
                <WelcomeBackHandler />
                <AppHeader />
                {children}
              </ToastProvider>
            </AppStoreProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
