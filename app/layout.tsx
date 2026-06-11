import type { Metadata } from "next";
import { Itim } from "next/font/google";
import "./globals.css";

const itim = Itim({
  subsets: ["latin", "thai"],
  weight: "400",
  variable: "--font-itim",
});

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
      <body className={itim.variable}>{children}</body>
    </html>
  );
}
