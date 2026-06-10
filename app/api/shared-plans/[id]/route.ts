import { getSharedPlan, saveSharedPlan } from "../../../lib/shared-plans-store";
import { rateLimit } from "../../rate-limit";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "shared-plan-read", 120);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const plan = await getSharedPlan(id);

    if (!plan) {
      return Response.json({ error: "ไม่พบตารางที่แชร์" }, { status: 404 });
    }

    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "โหลดตารางแชร์ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "shared-plan-write", 30);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const editToken = request.headers.get("x-edit-token") ?? "";
    const plan = await saveSharedPlan(id, { ...payload, editToken });

    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "บันทึกตารางแชร์ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
