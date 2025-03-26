export async function GET(request: Request, { params }: { params: { streamId: string } }) {
  // Replace with your actual upstream SSE endpoint.
  const upstreamUrl = `${process.env.AGENTS_API_URL}/chat_stream/${params.streamId}`;
  console.log('upstreamUrl', upstreamUrl);
  
  // Fetch the upstream SSE stream.
  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.AGENTS_API_KEY || 'test'}`,
    },
    cache: 'no-store',
  });

  // If the upstream request fails, return a 502 Bad Gateway.
  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response("Error connecting to upstream SSE stream", { status: 502 });
  }

  const reader = upstreamResponse.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Read from the upstream stream continuously.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Immediately enqueue each received chunk.
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}