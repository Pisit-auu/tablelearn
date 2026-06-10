import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ตารางเรียนส่วนตัว",
  description: "วางแผนรายวิชา ตารางเรียน และตารางสอบ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
