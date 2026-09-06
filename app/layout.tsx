import type { Metadata, Viewport } from "next";
import { Montserrat, Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-th",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mont",
  display: "swap",
});

const directionContract = `<!--
THESIS: The planner wears the KMUTNB registrar console's own theme, so the tab the student
switches to from reg.kmutnb.ac.th feels like the same desk — without ever claiming to be it.
Refuses the dark industrial world it replaces and the pastel rounded calendar app.
OWN-WORLD: Registrar console. #f8f8f8 ground, white 6px cards under 0 4px 24px rgba(34,41,47,.1),
teal #00aa9f as the only working colour, active nav as a 118deg teal gradient pill with a teal
glow, 12% light-primary tints, #5e5873 headings over #6e6b7b body, Prompt for Thai and Montserrat
for numerals, Feather-weight icons. One red (#ea5455) reserved for a time clash, one amber
(#ff9f43) for exam risk.
STORY: The student reads this week, sees clashes flagged in red before anything else, tries
sections, compares two plans, and walks into registration knowing what to click.
FIRST VIEWPORT: White 260px menu (brand, teal CTA, seven zone links, live plan readout) beside a
content column opening on the plan bar, the clash/exam alerts, then the full 07:00-20:00 week.
FORM: Pinned by the user to reg.kmutnb.ac.th/registrar/home, overriding direction seed c92d1359.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

export const metadata: Metadata = {
  title: "TableLearn — วางแผนลงทะเบียน มจพ.",
  description: "วางแผนรายวิชา ตารางเรียน ตารางสอบ และจัดตารางร่วมกัน สำหรับนักศึกษา มจพ.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${prompt.variable} ${montserrat.variable}`}>
        <div hidden dangerouslySetInnerHTML={{ __html: directionContract }} />
        {children}
      </body>
    </html>
  );
}
