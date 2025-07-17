import { getResponse } from "@/app/lib/agents";
import { agentWorkflowsCollection, twilioConfigsCollection, twilioInboundCallsCollection } from "@/app/lib/mongodb";
import { collectProjectTools } from "@/app/lib/project_tools";
import { PrefixLogger } from "@/app/lib/utils";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { hangup, XmlResponse, ZStandardRequestParams } from "../../utils";
import { Message } from "@/app/lib/types/types";

const ZRequestData = ZStandardRequestParams.extend({
    SpeechResult: z.string(),
    Confidence: z.string(),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ callSid: string }> }
) {
    const { callSid } = await params;
    let logger = new PrefixLogger(`turn:${callSid}`);
    logger.log("Received turn");

    // parse and validate form data
    const formData = await request.formData();
    logger.log('request body:', JSON.stringify(Object.fromEntries(formData)));
    const data = ZRequestData.parse(Object.fromEntries(formData));

    // get call state from db
    // if not found, hangup the call
    const call = await twilioInboundCallsCollection.findOne({
        callSid,
    });
    if (!call) {
        logger.log('Call not found');
        return hangup();
    }
    const { workflowId, projectId } = call;

    // fetch workflow
    const workflow = await agentWorkflowsCollection.findOne({
        projectId: projectId,
        _id: new ObjectId(workflowId),
    });
    if (!workflow) {
        logger.log(`Workflow ${workflowId} not found for project ${projectId}`);
        return hangup();
    }

    // fetch project tools
    const projectTools = await collectProjectTools(projectId);

    // add user speech as user message, and get assistant response
    const reqMessages: z.infer<typeof Message>[] = [
        ...call.messages,
        {
            role: 'user',
            content: data.SpeechResult,
        }
    ];
    const { messages } = await getResponse(workflow, projectTools, reqMessages);
    if (messages.length === 0) {
        logger.log('Agent response is empty');
        return hangup();
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant' || !lastMessage.content) {
        logger.log('Invalid last message');
        return hangup();
    }

    // save call state
    await twilioInboundCallsCollection.updateOne({
        _id: call._id,
    }, {
        $set: {
            messages: [
                ...reqMessages,
                ...messages,
            ],
            lastUpdatedAt: new Date().toISOString(),
        }
    });

    // speak out response
    const response = new VoiceResponse();
    response.say(lastMessage.content);
    response.gather({
        input: ['speech'],
        speechTimeout: 'auto',
        language: 'en-US',
        enhanced: true,
        speechModel: 'phone_call',
        action: `/api/twilio/turn/${callSid}`,
    });
    return XmlResponse(response);
}