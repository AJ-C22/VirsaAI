export async function GET(
    request: Request,
    context: { params: Promise<{ storyId: string }> }
  ) {
    // IMPORTANT: await the params in Next.js 15+
    const { storyId } = await context.params;
  
    console.log("PARAMS:", storyId);
  
    if (!storyId) {
      return Response.json({ error: "Missing storyId" }, { status: 400 });
    }
  
    try {
      const response = await fetch(`http://localhost:8000/timeline/${storyId}`);
      
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      
      const data = await response.json();
      return Response.json(data);
    } catch (error) {
      console.error("Backend error:", error);
      return Response.json(
        { error: "Backend error", details: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
      );
    }
  }