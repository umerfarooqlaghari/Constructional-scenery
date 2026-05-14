import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CS HQ — Construct Scenery Limited",
  description: "Business management platform for Construct Scenery Limited",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-slate-50 font-sans">
        <Sidebar />
        <div className="pl-60 min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
