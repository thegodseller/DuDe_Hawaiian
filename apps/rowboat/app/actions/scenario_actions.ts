'use server';
import { ObjectId } from "mongodb";
import { scenariosCollection } from "@/app/lib/mongodb";
import { z } from 'zod';
import { Scenario, WithStringId } from "../lib/types";
import { projectAuthCheck } from "./project_actions";

export async function getScenarios(projectId: string): Promise<WithStringId<z.infer<typeof Scenario>>[]> {
    await projectAuthCheck(projectId);

    const scenarios = await scenariosCollection.find({ projectId }).toArray();
    return scenarios.map(s => ({ ...s, _id: s._id.toString() }));
}

export async function createScenario(projectId: string, name: string, description: string): Promise<string> {
    await projectAuthCheck(projectId);

    const now = new Date().toISOString();
    const result = await scenariosCollection.insertOne({
        projectId,
        name,
        description,
        context: '',  // Always empty string
        lastUpdatedAt: now,
        createdAt: now,
    });
    return result.insertedId.toString();
}

export async function updateScenario(projectId: string, scenarioId: string, name: string, description: string) {
    await projectAuthCheck(projectId);

    await scenariosCollection.updateOne({
        "_id": new ObjectId(scenarioId),
        "projectId": projectId,
    }, {
        $set: {
            name,
            description,
            lastUpdatedAt: new Date().toISOString(),
        }
    });
}

export async function deleteScenario(projectId: string, scenarioId: string) {
    await projectAuthCheck(projectId);

    await scenariosCollection.deleteOne({
        "_id": new ObjectId(scenarioId),
        "projectId": projectId,
    });
}
