import { NextRequest } from "next/server";
import { apiKeysCollection, projectsCollection } from "../../lib/mongodb";

export async function authCheck(projectId: string, req: NextRequest, handler: () => Promise<Response>): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return Response.json({ error: "Authorization header must be a Bearer token" }, { status: 400 });
    }
    const key = authHeader.split(' ')[1];
    if (!key) {
        return Response.json({ error: "Missing API key in request" }, { status: 400 });
    }

    // check if api key is valid
    // while also updating last used timestamp
    const result = await apiKeysCollection.findOneAndUpdate(
        {
            projectId,
            key,
        },
        { $set: { lastUsedAt: new Date().toISOString() } }
    );
    if (!result) {
        return Response.json({ error: "Invalid API key" }, { status: 403 });
    }
    
    return await handler();
}
