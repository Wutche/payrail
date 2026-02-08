import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/NotificationProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Payrail | The Decentralized Payroll Engine",
  description:
    "Non-custodial, high-performance payroll infrastructure for global teams on Bitcoin & Stacks.",
  openGraph: {
    title: "Payrail | The Decentralized Payroll Engine",
    description:
      "Execute payroll in BTC & STX directly from your wallet. Non-custodial, secure, and fast.",
    url: "https://payrail-six.vercel.app",
    siteName: "Payrail",
    images: [
      {
        url: "https://payrail-six.vercel.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Payrail - Decentralized Payroll",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payrail | The Decentralized Payroll Engine",
    description: "Non-custodial payroll for the Bitcoin ecosystem.",
    images: ["https://payrail-six.vercel.app/opengraph-image.png"],
    creator: "@payrail",
  },
  metadataBase: new URL("https://payrail-six.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <NotificationProvider>{children}</NotificationProvider>
        </Providers>
      </body>
    </html>
  );
}
