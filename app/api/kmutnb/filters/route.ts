import { fetchCompressedJson, getToken } from "../_utils";

type ComboOption = {
  comboid: number | string;
  comboshow: string;
};

export async function GET() {
  try {
    const token = await getToken();
    const [campuses, divisions, levels, faculties, classSets] = await Promise.all([
      fetchCompressedJson<ComboOption[]>("ComboCam/All", token),
      fetchCompressedJson<ComboOption[]>("ComboDiv/All", token),
      fetchCompressedJson<ComboOption[]>("ComboLev/All", token),
      fetchCompressedJson<ComboOption[]>("ComboFac/All", token),
      fetchCompressedJson<ComboOption[]>("ComboSysbyt/getSysbytedes/CLASS/CLASSSET", token),
    ]);

    return Response.json({ campuses, divisions, levels, faculties, classSets });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "โหลดตัวกรองไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
