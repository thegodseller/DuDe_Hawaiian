import { NextRequest } from "next/server";
import { apiV1 } from "rowboat-shared";
import { db } from "@/app/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { authCheck } from "../../../utils";

const chatsCollection = db.collection<z.infer<typeof apiV1.Chat>>("chats");

export async function POST(
    request: NextRequest,
    { params }: { params: { chatId: string } }
): Promise<Response> {
    return await authCheck(request, async (session) => {
        const { chatId } = params;

        const result = await chatsCollection.findOneAndUpdate(
            {
                _id: new ObjectId(chatId),
                projectId: session.projectId,
                userId: session.userId,
                closed: { $exists: false },
            },
            {
                $set: {
                    closed: true,
                    closedAt: new Date().toISOString(),
                    closeReason: "user-closed-chat",
                },
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return Response.json({ error: "Chat not found" }, { status: 404 });
        }

        return Response.json(result);
    });
}
