import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Brand typeface. Variable font, so every weight (400–700) comes from one file.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "SyncPads — Your Personalized Workspace", template: "%s · SyncPads" },
  description:
    "SyncPads is a customizable start page that brings your favorite websites, tools, bookmarks and notes together in one organized workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
