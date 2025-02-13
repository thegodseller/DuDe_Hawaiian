'use server';

import { ObjectId } from "mongodb";
import { scenariosCollection } from "@/app/lib/mongodb";
import { z } from 'zod';
import { projectAuthCheck } from "./project_actions";
import { Scenario, type WithStringId } from "@/app/lib/types";
import { SimulationScenarioData } from "@/app/lib/types";

export async function getScenarios(projectId: string): Promise<WithStringId<z.infer<typeof Scenario>>[]> {
    await projectAuthCheck(projectId);

    const scenarios = await scenariosCollection.find({ projectId }).toArray();
    return scenarios.map(s => ({
        ...s,
        _id: s._id.toString(),
    }));
}

export async function getScenario(projectId: string, scenarioId: string): Promise<WithStringId<z.infer<typeof SimulationScenarioData>>> {
    await projectAuthCheck(projectId);

    // fetch scenario
    const scenario = await scenariosCollection.findOne({
        _id: new ObjectId(scenarioId),
        projectId,
    });
    if (!scenario) {
        throw new Error('Scenario not found');
    }
    const { _id, description, ...rest } = scenario;
    return {
        ...rest,
        _id: _id.toString(),
        scenario: description,
    };
}

export async function createScenario(projectId: string, name: string, description: string): Promise<string> {
    await projectAuthCheck(projectId);

    const now = new Date().toISOString();
    const result = await scenariosCollection.insertOne({
        projectId,
        name,
        description,
        lastUpdatedAt: now,
        createdAt: now,
    });

    return result.insertedId.toString();
}

export async function updateScenario(
    projectId: string,
    scenarioId: string,
    updates: { name?: string; description?: string }
): Promise<void> {
    await projectAuthCheck(projectId);

    const updateData: any = {
        ...updates,
        lastUpdatedAt: new Date().toISOString(),
    };

    await scenariosCollection.updateOne(
        {
            _id: new ObjectId(scenarioId),
            projectId,
        },
        {
            $set: updateData,
        }
    );
}

export async function deleteScenario(projectId: string, scenarioId: string): Promise<void> {
    await projectAuthCheck(projectId);

    await scenariosCollection.deleteOne({
        _id: new ObjectId(scenarioId),
        projectId,
    });
} 