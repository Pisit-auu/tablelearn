import type { Metadata, Viewport } from "next";
import { Anuphan, Azeret_Mono, Chakra_Petch, Saira_Stencil_One } from "next/font/google";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-text",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
  variable: "--font-industrial",
  display: "swap",
});

const azeretMono = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-measure",
  display: "swap",
});

const sairaStencil = Saira_Stencil_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-quarry",
  display: "swap",
});

const directionContract = `<!--
THESIS: A week of classes is a quarry face — every section you take is a block cut out of the sky,
and every hour you keep is the blue void it leaves behind. Refuses the pastel rounded-card
calendar every timetable app ships.
OWN-WORLD: Depth-blue ground #0d2e5e, cumulus-white chamfered blocks cut into a sky-void #4da7e6
field that IS the open time, saw-silver cut edges, the course colour carried only by the block's
cut face. A bad cut hatches in fracture red #c2381f, not thunder-gray: a time collision is the one
thing that must read as danger, and thunder-gray #3f5364 is spent on exam weather instead. Quarry
stencil for the mark, industrial caps for labels, mono for numerals only (Azeret carries no Thai),
crosshair registration marks on each panel. No rounded cards, no pastel chips.
STORY: The student reads the face, cuts sections into it, sees collisions surface as fractures,
then commits one plan before registration opens.
FIRST VIEWPORT: Left strata rail carries the mark, the section index with one active notched tab,
and the live readout; the main column opens on the plan control strip, the collision/weather
strip, then the full-width week face. Primary action ดึงรายวิชาจากเว็บ sits in the rail head.
FORM: Cloud Quarry — catalog challenger, adopted by the user over the assigned roll; seed key 7e83ad0f.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

export const metadata: Metadata = {
  title: "TableLearn — วางแผนลงทะเบียน มจพ.",
  description: "วางแผนรายวิชา ตารางเรียน ตารางสอบ และจัดตารางร่วมกัน สำหรับนักศึกษา มจพ.",
};

export const viewport: Viewport = {
  themeColor: "#0d2e5e",
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
      <body className={`${anuphan.variable} ${chakraPetch.variable} ${azeretMono.variable} ${sairaStencil.variable}`}>
        <div hidden dangerouslySetInnerHTML={{ __html: directionContract }} />
        {children}
      </body>
    </html>
  );
}
