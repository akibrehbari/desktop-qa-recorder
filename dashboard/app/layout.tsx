import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "QA Recorder Dashboard",
  description: "Record and replay deterministic desktop UI test macros.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
