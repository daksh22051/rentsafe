import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentSafe",
  description: "Secure and verified rental platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
