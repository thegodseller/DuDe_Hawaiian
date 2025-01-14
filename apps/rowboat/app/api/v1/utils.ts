import { NextRequest } from "next/server";
import { projectsCollection } from "@/app/lib/mongodb";

export async function authCheck(projectId: string, req: NextRequest, handler: () => Promise<Response>): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return Response.json({ error: "Authorization header must be a Bearer token" }, { status: 400 });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return Response.json({ error: "Missing API key in request" }, { status: 400 });
    }

    // check the key in project settings
    const project = await projectsCollection.findOne({
        _id: projectId,
        secret: token,
    });
    if (!project) {
        return Response.json({ error: "Invalid API key" }, { status: 403 });
    }
    
    return await handler();
}
