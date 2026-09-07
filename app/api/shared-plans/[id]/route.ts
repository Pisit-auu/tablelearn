import { getSharedPlan, saveSharedPlan, SharedPlanError } from "../../../lib/shared-plans-store";
import { rateLimit } from "../../rate-limit";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof SharedPlanError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("shared-plans route failed", error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "shared-plan-read", 120);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const plan = await getSharedPlan(id);

    if (!plan) {
      return Response.json({ error: "ไม่พบห้องนี้" }, { status: 404 });
    }

    return Response.json(plan);
  } catch (error) {
    return errorResponse(error, "โหลดห้องไม่สำเร็จ");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "shared-plan-write", 30);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const payload = await request.json().catch(() => {
      throw new SharedPlanError("ข้อมูลที่ส่งมาไม่ใช่ JSON ที่ถูกต้อง");
    });
    const editToken = request.headers.get("x-edit-token") ?? "";
    const plan = await saveSharedPlan(id, { ...payload, editToken });

    return Response.json(plan);
  } catch (error) {
    return errorResponse(error, "บันทึกห้องไม่สำเร็จ");
  }
}
