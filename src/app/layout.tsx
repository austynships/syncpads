import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Brand typeface. Variable font, so every weight (400–700) comes from one file.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "SyncPads — The place your AI goes to understand how you work", template: "%s · SyncPads" },
  description:
    "SyncPads is your start page for the tools, docs and notes you rely on. Connect Claude, ChatGPT or Cursor and they use it too, so you stop re-explaining your work in every chat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
