import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { exportedPageStyles } from "@/puck/export-styles";
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
  title: "Puck Studio",
  description: "A Puck-based WYSIWYG page and form builder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: exportedPageStyles }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
