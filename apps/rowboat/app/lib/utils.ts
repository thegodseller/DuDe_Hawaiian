import { Workflow } from "@/app/lib/types";
import { projectsCollection } from "./mongodb";
import crypto from 'crypto';
import { z } from "zod";

export async function generateWebhookJwtSecret(projectId: string): Promise<string> {
    const secret = crypto.randomBytes(32).toString('hex');
    await projectsCollection.updateOne(
        { _id: projectId },
        { $set: { webhookJwtSecret: secret, webhookJwtSecretUpdatedAt: new Date().toISOString() } }
    );
    return secret;
}

export const baseWorkflow: z.infer<typeof Workflow> = {
    projectId: "",
    createdAt: "",
    lastUpdatedAt: "",
    startAgent: "Example Agent",
    agents: [
        {
            name: "Example Agent",
            type: "conversation",
            description: "",
            instructions: `## 🧑‍ Role:
You are an helpful customer support assistant

---
## ⚙️ Steps to Follow:
1. Ask the user what they would like help with
2. Ask the user for their email address and let them know someone will contact them soon.

---
## 🎯 Scope:
✅ In Scope:
- Asking the user their issue
- Getting their email

❌ Out of Scope:
- Questions unrelated to customer support
- If a question is out of scope, politely inform the user and avoid providing an answer.

---
## 📋 Guidelines:
✔️ Dos:
- ask user their issue

❌ Don'ts:
- don't ask user any other detail than email`,
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            toggleAble: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
        {
            name: "Guardrails",
            type: "guardrails",
            description: "",
            instructions: "Stick to the facts and do not make any assumptions.",
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            locked: true,
            toggleAble: true,
            global: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
        {
            name: "Post process",
            type: "post_process",
            description: "",
            instructions: "Ensure that the agent response is terse and to the point.",
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            locked: true,
            global: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
        {
            name: "Escalation",
            type: "escalation",
            description: "",
            instructions: "Get the user's contact information and let them know that their request has been escalated.",
            prompts: [],
            tools: [],
            model: "gpt-4o-mini",
            locked: true,
            toggleAble: true,
            ragReturnType: "chunks",
            ragK: 3,
            connectedAgents: [],
            controlType: "retain",
        },
    ],
    prompts: [
        {
            name: "Style prompt",
            type: "style_prompt",
            prompt: "You should be empathetic and helpful.",
        },
    ],
    tools: [],
};