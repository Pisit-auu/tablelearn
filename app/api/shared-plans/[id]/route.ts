import { getSharedPlan, saveSharedPlan } from "../../../lib/shared-plans-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const plan = await saveSharedPlan(id, payload);

    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "บันทึกตารางแชร์ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
