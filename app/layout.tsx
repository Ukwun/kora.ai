import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kora Commerce | Business Operating System",
  description: "AI-powered business operating system for modern service businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
