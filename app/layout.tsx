import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppThemeProvider } from "./components/AppThemeProvider";
import { AppNoticeProvider } from "./components/AppNotice";
import { getPublicSiteUrl, PUBLIC_OG_IMAGE_PATH, PUBLIC_SITE_NAME } from "@/lib/public-site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: "Household Toolbox - All your home life admin, in one place",
    template: "%s",
  },
  description: "The digital toolbox for your whole household. Add tools from the store, pin dates to one dashboard calendar, keep files on each record, and export a PDF when you want a copy.",
  openGraph: {
    siteName: PUBLIC_SITE_NAME,
    type: "website",
    images: [{ url: PUBLIC_OG_IMAGE_PATH, alt: PUBLIC_SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;r.classList.remove('light','dark');r.classList.add('dark');r.setAttribute('data-theme','dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppThemeProvider>
          <AppNoticeProvider>{children}</AppNoticeProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
