import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppThemeProvider } from "./components/AppThemeProvider";
import { AppNoticeProvider } from "./components/AppNotice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Household Toolbox - All your home life admin, in one place",
  description: "The digital toolbox for your whole household. Add tools from the store, pin dates to one dashboard calendar, keep files on each record, and export a PDF when you want a copy.",
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
