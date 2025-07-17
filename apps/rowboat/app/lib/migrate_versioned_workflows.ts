import { agentWorkflowsCollection, projectsCollection } from "./mongodb";
import { ObjectId } from "mongodb";
import { Workflow } from "./types/workflow_types";
import { z } from "zod";

export async function migrate_versioned_workflows(projectId: string) {
    // fetch project data
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project) {
        throw new Error(`Project ${projectId} not found`);
    }

    // Skip if project already has workflows migrated
    if (project.draftWorkflow && project.liveWorkflow) {
        console.log(`Project ${projectId} already has migrated workflows, skipping...`);
        return;
    }

    const updateFields: { draftWorkflow?: z.infer<typeof Workflow>; liveWorkflow?: z.infer<typeof Workflow> } = {};

    // 1. Migrate published workflow to liveWorkflow
    if (project.publishedWorkflowId) {
        const publishedWorkflow = await agentWorkflowsCollection.findOne({ 
            _id: new ObjectId(project.publishedWorkflowId)
        });
        
        if (publishedWorkflow) {
            // @ts-ignore - Workflow type mismatch
            const { _id, name, createdAt, projectId, ...rest } = publishedWorkflow;
            updateFields.liveWorkflow = rest;
            console.log(`Found published workflow ${project.publishedWorkflowId} for project ${projectId}`);
        } else {
            console.warn(`Published workflow ${project.publishedWorkflowId} not found for project ${projectId}`);
        }
    }

    // 2. Find the latest workflow for draft (that isn't the published one)
    const workflows = await agentWorkflowsCollection.find({
        projectId,
    }).sort({ lastUpdatedAt: -1 }).toArray();
    
    let latestWorkflow;
    for (const workflow of workflows) {
        // Skip if this is the published workflow
        if (project.publishedWorkflowId && workflow._id.toString() === project.publishedWorkflowId) {
            continue;
        }
        
        latestWorkflow = workflow;
        break;
    }

    // Handle cases where no published workflow exists
    if (!updateFields.liveWorkflow && latestWorkflow) {
        // No published workflow found, use latest as live workflow
        // @ts-ignore - Workflow type mismatch
        const { _id, name, createdAt, projectId, ...rest } = latestWorkflow;
        updateFields.liveWorkflow = rest;
        console.log(`No published workflow found, using latest workflow as live for project ${projectId}`);
    }

    // Set draft workflow
    if (latestWorkflow) {
        // @ts-ignore - Workflow type mismatch
        const { _id, name, createdAt, projectId, ...rest } = latestWorkflow;
        updateFields.draftWorkflow = rest;
        console.log(`Found draft workflow for project ${projectId}`);
    } else if (updateFields.liveWorkflow) {
        // No separate draft found, use the published workflow as draft too
        updateFields.draftWorkflow = updateFields.liveWorkflow;
        console.log(`No separate draft found, using live workflow as draft for project ${projectId}`);
    }

    // 3. Update the project with the migrated workflows
    if (Object.keys(updateFields).length > 0) {
        await projectsCollection.updateOne(
            { _id: projectId },
            { $set: updateFields }
        );
        console.log(`Successfully migrated ${Object.keys(updateFields).length} workflow(s) for project ${projectId}`);
    } else {
        console.log(`No workflows found to migrate for project ${projectId}`);
    }
}