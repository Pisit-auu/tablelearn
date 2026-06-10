import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableLearn",
  description: "วางแผนรายวิชา ตารางเรียน ตารางสอบ และจัดตารางร่วมกัน",
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
