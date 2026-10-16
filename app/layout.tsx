import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kora | Business Operating System",
  description: "Workspace-aware operating intelligence for the people, work, and money behind your business.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
