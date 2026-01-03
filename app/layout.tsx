import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { SearchProvider } from "@/lib/search/SearchContext";
import { AppHeader } from "@/components/layout/AppHeader";

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
        <link rel="icon" href="/assets/c2c-icon.png" type="image/png" />
      </head>
      <body className={robotoMono.className}>
        <AuthProvider>
          <SearchProvider>
            <AppHeader />
            {children}
          </SearchProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
