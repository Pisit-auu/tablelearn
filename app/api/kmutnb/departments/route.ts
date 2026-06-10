import { fetchCompressedJson, getToken } from "../_utils";
import { rateLimit } from "../../rate-limit";

type ComboOption = {
  comboid: number | string;
  comboshow: string;
};

export async function GET(request: Request) {
  const limited = rateLimit(request, "kmutnb-departments", 30);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const faculty = searchParams.get("faculty")?.trim();

  if (!faculty || !/^\d+$/.test(faculty)) {
    return Response.json({ error: "รหัสคณะไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const token = await getToken();
    const departments = await fetchCompressedJson<ComboOption[]>(`ComboDep/All/${faculty}`, token);

    return Response.json({ departments });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "โหลดภาควิชาไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
