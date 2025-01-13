import { Metadata } from "next";
import { agentWorkflowsCollection, dataSourcesCollection, projectsCollection } from "@/app/lib/mongodb";
import { App } from "./app";
import { baseWorkflow } from "@/app/lib/utils";

export const metadata: Metadata = {
    title: "Workflow"
}

export default async function Page({
    params,
}: {
    params: { projectId: string };
}) {
    let startWithWorkflowId = null;
    const count = await agentWorkflowsCollection.countDocuments({
        projectId: params.projectId,
    });
    if (count === 0) {
        // get the next workflow number
        const doc = await projectsCollection.findOneAndUpdate({
            _id: params.projectId,
        }, {
            $inc: {
                nextWorkflowNumber: 1,
            },
        }, {
            returnDocument: 'after'
        });
        if (!doc) {
            throw new Error('Project not found');
        }
        const nextWorkflowNumber = doc.nextWorkflowNumber;

        // create the workflow
        const workflow = {
            ...baseWorkflow,
            projectId: params.projectId,
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            name: `Version ${nextWorkflowNumber}`,
        };
        const { insertedId } = await agentWorkflowsCollection.insertOne(workflow);
        startWithWorkflowId = insertedId.toString();
    }

    return <App
        projectId={params.projectId}
        startWithWorkflowId={startWithWorkflowId}
    />;
}
