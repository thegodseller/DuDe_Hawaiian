import { MongoClient } from "mongodb";
import { PlaygroundChat, DataSource, EmbeddingDoc, Project, Webpage, ChatClientId, Workflow, Scenario, ProjectMember, ApiKey, DataSourceDoc } from "./types";
import { z } from 'zod';

const client = new MongoClient(process.env["MONGODB_CONNECTION_STRING"] || "mongodb://localhost:27017");

export const db = client.db("rowboat");
export const dataSourcesCollection = db.collection<z.infer<typeof DataSource>>("sources");
export const dataSourceDocsCollection = db.collection<z.infer<typeof DataSourceDoc>>("source_docs");
export const embeddingsCollection = db.collection<z.infer<typeof EmbeddingDoc>>("embeddings");
export const projectsCollection = db.collection<z.infer<typeof Project>>("projects");
export const projectMembersCollection = db.collection<z.infer<typeof ProjectMember>>("project_members");
export const webpagesCollection =  db.collection<z.infer<typeof Webpage>>('webpages');
export const agentWorkflowsCollection = db.collection<z.infer<typeof Workflow>>("agent_workflows");
export const scenariosCollection = db.collection<z.infer<typeof Scenario>>("scenarios");
export const apiKeysCollection = db.collection<z.infer<typeof ApiKey>>("api_keys");