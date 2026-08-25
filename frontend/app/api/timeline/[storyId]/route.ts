const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function GET(
  request: Request,
  context: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await context.params;
  if (!storyId) {
    return Response.json({ error: "Missing storyId" }, { status: 400 });
  }

  const auth = request.headers.get("authorization") || "";
  try {
    const response = await fetch(`${API_ROOT}/timeline/${storyId}`, {
      headers: auth ? { Authorization: auth } : {},
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error: "Backend error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
