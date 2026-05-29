/**
 * Root layout — minimal placeholder.
 * The frontend agent will replace this with the real branded layout.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barrio Logan Guest Concierge",
  description: "Your local guide and AI concierge for your stay in Barrio Logan, San Diego.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
