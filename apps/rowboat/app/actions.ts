'use server';

import { redirect } from "next/navigation";
import { SimulationData, EmbeddingDoc, GetInformationToolResult, DataSource, PlaygroundChat, AgenticAPIChatRequest, AgenticAPIChatResponse, convertFromAgenticAPIChatMessages, WebpageCrawlResponse, Workflow, WorkflowAgent, CopilotAPIRequest, CopilotAPIResponse, CopilotMessage, CopilotWorkflow, convertToCopilotWorkflow, convertToCopilotApiMessage, convertToCopilotMessage, CopilotAssistantMessage, CopilotChatContext, convertToCopilotApiChatContext, Scenario, ClientToolCallRequestBody, ClientToolCallJwt, ClientToolCallRequest, WithStringId, Project, WorkflowTool, WorkflowPrompt, ApiKey } from "./lib/types";
import { ObjectId, WithId } from "mongodb";
import { generateObject, generateText, embed } from "ai";
import { dataSourcesCollection, embeddingsCollection, projectsCollection, webpagesCollection, agentWorkflowsCollection, scenariosCollection, projectMembersCollection, apiKeysCollection } from "@/app/lib/mongodb";
import { z } from 'zod';
import { openai } from "@ai-sdk/openai";
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';
import { embeddingModel } from "./lib/embedding";
import { apiV1 } from "rowboat-shared";
import { zodToJsonSchema } from 'zod-to-json-schema';
import crypto from 'crypto';
import { Claims, getSession } from "@auth0/nextjs-auth0";
import { revalidatePath } from "next/cache";
import { callClientToolWebhook, getAgenticApiResponse } from "./lib/utils";
import { templates } from "./lib/project_templates";
import { assert, error } from "node:console";
import { check_query_limit } from "./lib/rate_limiting";
import { QueryLimitError } from "./lib/client_utils";

const crawler = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY || '' });

export async function authCheck(): Promise<Claims> {
    const { user } = await getSession() || {};
    if (!user) {
        throw new Error('User not authenticated');
    }
    return user;
}

export async function projectAuthCheck(projectId: string) {
    const user = await authCheck();
    const membership = await projectMembersCollection.findOne({
        projectId,
        userId: user.sub,
    });
    if (!membership) {
        throw new Error('User not a member of project');
    }
}

export async function createWorkflow(projectId: string): Promise<WithStringId<z.infer<typeof Workflow>>> {
    await projectAuthCheck(projectId);

    // get the next workflow number
    const doc = await projectsCollection.findOneAndUpdate({
        _id: projectId,
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
    const { agents, prompts, tools, startAgent } = templates['default'];
    const workflow = {
        agents,
        prompts,
        tools,
        startAgent,
        projectId,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        name: `Version ${nextWorkflowNumber}`,
    };
    const { insertedId } = await agentWorkflowsCollection.insertOne(workflow);
    const { _id, ...rest } = workflow as WithId<z.infer<typeof Workflow>>;
    return {
        ...rest,
        _id: insertedId.toString(),
    };
}

export async function cloneWorkflow(projectId: string, workflowId: string): Promise<WithStringId<z.infer<typeof Workflow>>> {
    await projectAuthCheck(projectId);
    const workflow = await agentWorkflowsCollection.findOne({
        _id: new ObjectId(workflowId),
        projectId,
    });
    if (!workflow) {
        throw new Error('Workflow not found');
    }

    // create a new workflow with the same content
    const newWorkflow = {
        ...workflow,
        _id: new ObjectId(),
        name: `Copy of ${workflow.name || 'Unnamed workflow'}`,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
    };
    const { insertedId } = await agentWorkflowsCollection.insertOne(newWorkflow);
    const { _id, ...rest } = newWorkflow as WithId<z.infer<typeof Workflow>>;
    return {
        ...rest,
        _id: insertedId.toString(),
    };
}

export async function renameWorkflow(projectId: string, workflowId: string, name: string) {
    await projectAuthCheck(projectId);

    await agentWorkflowsCollection.updateOne({
        _id: new ObjectId(workflowId),
        projectId,
    }, {
        $set: {
            name,
            lastUpdatedAt: new Date().toISOString(),
        },
    });
}

export async function saveWorkflow(projectId: string, workflowId: string, workflow: z.infer<typeof Workflow>) {
    await projectAuthCheck(projectId);

    // check if workflow exists
    const existingWorkflow = await agentWorkflowsCollection.findOne({
        _id: new ObjectId(workflowId),
        projectId,
    });
    if (!existingWorkflow) {
        throw new Error('Workflow not found');
    }

    // ensure that this is not the published workflow for this project
    const publishedWorkflowId = await fetchPublishedWorkflowId(projectId);
    if (publishedWorkflowId && publishedWorkflowId === workflowId) {
        throw new Error('Cannot save published workflow');
    }

    // update the workflow, except name and description
    const { _id, name, ...rest } = workflow as WithId<z.infer<typeof Workflow>>;
    await agentWorkflowsCollection.updateOne({
        _id: new ObjectId(workflowId),
    }, {
        $set: {
            ...rest,
            lastUpdatedAt: new Date().toISOString(),
        },
    });
}

export async function publishWorkflow(projectId: string, workflowId: string) {
    await projectAuthCheck(projectId);

    // check if workflow exists
    const existingWorkflow = await agentWorkflowsCollection.findOne({
        _id: new ObjectId(workflowId),
        projectId,
    });
    if (!existingWorkflow) {
        throw new Error('Workflow not found');
    }

    // publish the workflow 
    await projectsCollection.updateOne({
        "_id": projectId,
    }, {
        $set: {
            publishedWorkflowId: workflowId,
        }
    });
}

export async function fetchPublishedWorkflowId(projectId: string): Promise<string | null> {
    await projectAuthCheck(projectId);
    const project = await projectsCollection.findOne({
        _id: projectId,
    });
    return project?.publishedWorkflowId || null;
}

export async function fetchWorkflow(projectId: string, workflowId: string): Promise<WithStringId<z.infer<typeof Workflow>>> {
    await projectAuthCheck(projectId);

    // fetch workflow
    const workflow = await agentWorkflowsCollection.findOne({
        _id: new ObjectId(workflowId),
        projectId,
    });
    if (!workflow) {
        throw new Error('Workflow not found');
    }
    const { _id, ...rest } = workflow;
    return {
        ...rest,
        _id: _id.toString(),
    };
}

export async function listWorkflows(
    projectId: string,
    page: number = 1,
    limit: number = 10
): Promise<{
    workflows: (WithStringId<z.infer<typeof Workflow>>)[];
    total: number;
    publishedWorkflowId: string | null;
}> {
    await projectAuthCheck(projectId);

    // fetch total count
    const total = await agentWorkflowsCollection.countDocuments({ projectId });

    // fetch published workflow
    let publishedWorkflowId: string | null = null;
    let publishedWorkflow: WithId<z.infer<typeof Workflow>> | null = null;
    if (page === 1) {
        publishedWorkflowId = await fetchPublishedWorkflowId(projectId);
        if (publishedWorkflowId) {
            publishedWorkflow = await agentWorkflowsCollection.findOne({
                _id: new ObjectId(publishedWorkflowId),
                projectId,
            }, {
                projection: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    createdAt: 1,
                    lastUpdatedAt: 1,
                },
            });
        }
    }

    // fetch workflows with pagination
    let workflows: WithId<z.infer<typeof Workflow>>[] = await agentWorkflowsCollection.find(
        {
            projectId,
            ...(publishedWorkflowId ? {
                _id: {
                    $ne: new ObjectId(publishedWorkflowId)
                }
            } : {}),
        },
        {
            sort: { lastUpdatedAt: -1 },
            projection: {
                _id: 1,
                name: 1,
                description: 1,
                createdAt: 1,
                lastUpdatedAt: 1,
            },
            skip: (page - 1) * limit,
            limit: limit,
        }
    ).toArray();
    workflows = [
        ...(publishedWorkflow ? [publishedWorkflow] : []),
        ...workflows,
    ];

    // return workflows
    return {
        workflows: workflows.map((w) => {
            const { _id, ...rest } = w;
            return {
                ...rest,
                _id: _id.toString(),
            };
        }),
        total,
        publishedWorkflowId,
    };
}

export async function scrapeWebpage(url: string): Promise<z.infer<typeof WebpageCrawlResponse>> {
    const page = await webpagesCollection.findOne({
        "_id": url,
        lastUpdatedAt: {
            '$gte': new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 24 hours
        },
    });
    if (page) {
        // console.log("found webpage in db", url);
        return {
            title: page.title,
            content: page.contentSimple,
        };
    }

    // otherwise use firecrawl
    const scrapeResult = await crawler.scrapeUrl(
        url,
        {
            formats: ['markdown'],
            onlyMainContent: true
        }
    ) as ScrapeResponse;

    // save the webpage using upsert
    await webpagesCollection.updateOne(
        { _id: url },
        {
            $set: {
                title: scrapeResult.metadata?.title || '',
                contentSimple: scrapeResult.markdown || '',
                lastUpdatedAt: (new Date()).toISOString(),
            }
        },
        { upsert: true }
    );

    // console.log("crawled webpage", url);
    return {
        title: scrapeResult.metadata?.title || '',
        content: scrapeResult.markdown || '',
    };
}

export async function createProject(formData: FormData) {
    const user = await authCheck();

    // ensure that projects created by this user is less than
    // configured limit
    const projectsLimit = Number(process.env.MAX_PROJECTS_PER_USER) || 0;
    if (projectsLimit > 0) {
        const count = await projectsCollection.countDocuments({
            createdByUserId: user.sub,
        });
        if (count >= projectsLimit) {
            throw new Error('You have reached your project limit. Please upgrade your plan.');
        }
    }

    const name = formData.get('name') as string;
    const templateKey = formData.get('template') as string;
    const projectId = crypto.randomUUID();
    const chatClientId = crypto.randomBytes(16).toString('base64url');
    const secret = crypto.randomBytes(32).toString('hex');

    // create project
    await projectsCollection.insertOne({
        _id: projectId,
        name: name,
        createdAt: (new Date()).toISOString(),
        lastUpdatedAt: (new Date()).toISOString(),
        createdByUserId: user.sub,
        chatClientId,
        secret,
        nextWorkflowNumber: 1,
    });

    // add first workflow version
    const { agents, prompts, tools, startAgent } = templates[templateKey];
    await agentWorkflowsCollection.insertOne({
        _id: new ObjectId(),
        projectId,
        agents,
        prompts,
        tools,
        startAgent,
        createdAt: (new Date()).toISOString(),
        lastUpdatedAt: (new Date()).toISOString(),
        name: `Version 1`,
    });

    // add user to project
    await projectMembersCollection.insertOne({
        userId: user.sub,
        projectId: projectId,
        createdAt: (new Date()).toISOString(),
        lastUpdatedAt: (new Date()).toISOString(),
    });

    redirect(`/projects/${projectId}/workflow`);
}

export async function getProjectConfig(projectId: string): Promise<WithStringId<z.infer<typeof Project>>> {
    await projectAuthCheck(projectId);
    const project = await projectsCollection.findOne({
        _id: projectId,
    });
    if (!project) {
        throw new Error('Project config not found');
    }
    return project;
}

export async function listProjects(): Promise<z.infer<typeof Project>[]> {
    const user = await authCheck();
    const memberships = await projectMembersCollection.find({
        userId: user.sub,
    }).toArray();
    const projectIds = memberships.map((m) => m.projectId);
    const projects = await projectsCollection.find({
        _id: { $in: projectIds },
    }).toArray();
    return projects;
}

export async function listSources(projectId: string): Promise<WithStringId<z.infer<typeof DataSource>>[]> {
    await projectAuthCheck(projectId);
    const sources = await dataSourcesCollection.find({
        projectId: projectId,
    }).toArray();
    return sources.map((s) => ({
        ...s,
        _id: s._id.toString(),
    }));
}

export async function createCrawlDataSource(projectId: string, formData: FormData) {
    await projectAuthCheck(projectId);
    const url = formData.get('url') as string;
    const name = formData.get('name') as string;
    const limit = Number(formData.get('limit'));

    const result = await dataSourcesCollection.insertOne({
        projectId: projectId,
        active: true,
        name: name,
        createdAt: (new Date()).toISOString(),
        status: "new",
        data: {
            type: 'crawl',
            startUrl: url,
            limit: limit,
        }
    });

    redirect(`/projects/${projectId}/sources/${result.insertedId}`);
}

export async function createUrlsDataSource(projectId: string, formData: FormData) {
    await projectAuthCheck(projectId);
    const urls = formData.get('urls') as string;
    // take first 100 urls
    const limitedUrls = urls.split('\n').slice(0, 100).map((url) => url.trim());
    const name = formData.get('name') as string;

    const result = await dataSourcesCollection.insertOne({
        projectId: projectId,
        active: true,
        name: name,
        createdAt: (new Date()).toISOString(),
        status: "new",
        data: {
            type: 'urls',
            urls: limitedUrls,
        }
    });

    redirect(`/projects/${projectId}/sources/${result.insertedId}`);
}

export async function recrawlWebDataSource(projectId: string, sourceId: string) {
    await projectAuthCheck(projectId);

    const source = await dataSourcesCollection.findOne({
        "_id": new ObjectId(sourceId),
        "projectId": projectId,
    });
    if (!source) {
        throw new Error('Data source not found');
    }

    await dataSourcesCollection.updateOne({
        "_id": new ObjectId(sourceId),
    }, {
        $set: {
            "status": "new",
            "attempts": 0,
        },
        $unset: {
            'data.firecrawlId': '',
            'data.crawledUrls': '',
            'data.scrapedUrls': '',
        }
    });

    revalidatePath(`/projects/${projectId}/sources/${sourceId}`);
}

export async function deleteDataSource(projectId: string, sourceId: string) {
    await projectAuthCheck(projectId);

    await dataSourcesCollection.deleteOne({
        _id: new ObjectId(sourceId),
    });

    await embeddingsCollection.deleteMany({
        sourceId: sourceId,
    });

    redirect(`/projects/${projectId}/sources`);
}

export async function getAssistantResponse(
    projectId: string,
    request: z.infer<typeof AgenticAPIChatRequest>,
): Promise<{
    messages: z.infer<typeof apiV1.ChatMessage>[],
    state: unknown,
    rawRequest: unknown,
    rawResponse: unknown,
}> {
    await projectAuthCheck(projectId);
    if (!await check_query_limit(projectId)) {
        throw new QueryLimitError();
    }

    const response = await getAgenticApiResponse(request);
    return {
        messages: convertFromAgenticAPIChatMessages(response.messages),
        state: response.state,
        rawRequest: request,
        rawResponse: response.rawAPIResponse,
    };
}

export async function getCopilotResponse(
    projectId: string,
    messages: z.infer<typeof CopilotMessage>[],
    current_workflow_config: z.infer<typeof Workflow>,
    context: z.infer<typeof CopilotChatContext> | null,
): Promise<{
    message: z.infer<typeof CopilotAssistantMessage>,
    rawRequest: unknown,
    rawResponse: unknown,
}> {
    await projectAuthCheck(projectId);
    if (!await check_query_limit(projectId)) {
        throw new QueryLimitError();
    }

    // prepare request
    const request: z.infer<typeof CopilotAPIRequest> = {
        messages: messages.map(convertToCopilotApiMessage),
        workflow_schema: JSON.stringify(zodToJsonSchema(CopilotWorkflow)),
        current_workflow_config: JSON.stringify(convertToCopilotWorkflow(current_workflow_config)),
        context: context ? convertToCopilotApiChatContext(context) : null,
    };
    console.log(`copilot request`, JSON.stringify(request, null, 2));

    // call copilot api
    const response = await fetch(process.env.COPILOT_API_URL + '/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COPILOT_API_KEY || 'test'}`,
        },
    });
    if (!response.ok) {
        console.error('Failed to call copilot api', response);
        throw new Error(`Failed to call copilot api: ${response.statusText}`);
    }

    // parse and return response
    const json: z.infer<typeof CopilotAPIResponse> = await response.json();
    console.log(`copilot response`, JSON.stringify(json, null, 2));
    if ('error' in json) {
        throw new Error(`Failed to call copilot api: ${json.error}`);
    }
    // remove leading ```json and trailing ```
    const msg = convertToCopilotMessage({
        role: 'assistant',
        content: json.response.replace(/^```json\n/, '').replace(/\n```$/, ''),
    });

    // validate response schema
    assert(msg.role === 'assistant');
    if (msg.role === 'assistant') {
        for (const part of msg.content.response) {
            if (part.type === 'action') {
                switch (part.content.config_type) {
                    case 'tool': {
                        const test = {
                            name: 'test',
                            description: 'test',
                            parameters: {
                                type: 'object',
                                properties: {},
                                required: [],
                            },
                        } as z.infer<typeof WorkflowTool>;
                        // iterate over each field in part.content.config_changes
                        // and test if the final object schema is valid
                        // if not, discard that field
                        for (const [key, value] of Object.entries(part.content.config_changes)) {
                            const result = WorkflowTool.safeParse({
                                ...test,
                                [key]: value,
                            });
                            if (!result.success) {
                                console.log(`discarding field ${key} from ${part.content.config_type}: ${part.content.name}`, result.error.message);
                                delete part.content.config_changes[key];
                            }
                        }
                        break;
                    }
                    case 'agent': {
                        const test = {
                            name: 'test',
                            description: 'test',
                            type: 'conversation',
                            instructions: 'test',
                            prompts: [],
                            tools: [],
                            model: 'gpt-4o',
                            ragReturnType: 'chunks',
                            ragK: 10,
                            connectedAgents: [],
                            controlType: 'retain',
                        } as z.infer<typeof WorkflowAgent>;
                        // iterate over each field in part.content.config_changes
                        // and test if the final object schema is valid
                        // if not, discard that field
                        for (const [key, value] of Object.entries(part.content.config_changes)) {
                            const result = WorkflowAgent.safeParse({
                                ...test,
                                [key]: value,
                            });
                            if (!result.success) {
                                console.log(`discarding field ${key} from ${part.content.config_type}: ${part.content.name}`, result.error.message);
                                delete part.content.config_changes[key];
                            }
                        }
                        break;
                    }
                    case 'prompt': {
                        const test = {
                            name: 'test',
                            type: 'base_prompt',
                            prompt: "test",
                        } as z.infer<typeof WorkflowPrompt>;
                        // iterate over each field in part.content.config_changes
                        // and test if the final object schema is valid
                        // if not, discard that field
                        for (const [key, value] of Object.entries(part.content.config_changes)) {
                            const result = WorkflowPrompt.safeParse({
                                ...test,
                                [key]: value,
                            });
                            if (!result.success) {
                                console.log(`discarding field ${key} from ${part.content.config_type}: ${part.content.name}`, result.error.message);
                                delete part.content.config_changes[key];
                            }
                        }
                        break;
                    }
                    default: {
                        part.content.error = `Unknown config type: ${part.content.config_type}`;
                        break;
                    }
                }
            }
        }
    }

    return {
        message: msg as z.infer<typeof CopilotAssistantMessage>,
        rawRequest: request,
        rawResponse: json,
    };
}

export async function suggestToolResponse(toolId: string, projectId: string, messages: z.infer<typeof apiV1.ChatMessage>[]): Promise<string> {
    await projectAuthCheck(projectId);
    if (!await check_query_limit(projectId)) {
        throw new QueryLimitError();
    }

    const prompt = `
# Your Specific Task:
Here is a chat between a user and a customer support assistant.
The assistant has requested a tool call with ID {{toolID}}.
Your job is to come up with an example of the data that the tool call should return.
The current date is {{date}}.

CONVERSATION:
{{messages}}
`
        .replace('{{toolID}}', toolId)
        .replace(`{{date}}`, new Date().toISOString())
        .replace('{{messages}}', JSON.stringify(messages.map((m) => {
            let tool_calls;
            if ('tool_calls' in m && m.role == 'assistant') {
                tool_calls = m.tool_calls;
            }
            let { role, content } = m;
            return {
                role,
                content,
                tool_calls,
            }
        })));
    // console.log(prompt);

    const { object } = await generateObject({
        model: openai("gpt-4o"),
        prompt: prompt,
        schema: z.object({
            result: z.any(),
        }),
    });

    return JSON.stringify(object);
}

export async function getDataSource(projectId: string, sourceId: string): Promise<z.infer<typeof DataSource>> {
    await projectAuthCheck(projectId);

    const source = await dataSourcesCollection.findOne({
        "_id": new ObjectId(sourceId),
        "projectId": projectId,
    });
    if (!source) {
        throw new Error('Data source not found');
    }
    // send source without _id
    const { _id, ...sourceData } = source;
    return sourceData
}

export async function getUpdatedSourceStatus(projectId: string, sourceId: string) {
    await projectAuthCheck(projectId);

    const source = await dataSourcesCollection.findOne({
        "_id": new ObjectId(sourceId),
        "projectId": projectId,
    }, {
        projection: {
            status: 1,
        }
    });
    if (!source) {
        throw new Error('Data source not found');
    }
    return source.status;
}

export async function getInformationTool(
    projectId: string,
    query: string,
    sourceIds: string[],
    returnType: z.infer<typeof WorkflowAgent>['ragReturnType'],
    k: number,
): Promise<z.infer<typeof GetInformationToolResult>> {
    await projectAuthCheck(projectId);

    // create embedding for question
    const embedResult = await embed({
        model: embeddingModel,
        value: query,
    });

    // fetch all data sources for this project
    const sources = await dataSourcesCollection.find({
        projectId: projectId,
        active: true,
    }).toArray();
    const validSourceIds = sources
        .filter(s => sourceIds.includes(s._id.toString())) // id should be in sourceIds
        .filter(s => s.active) // should be active
        .map(s => s._id.toString());

    // if no sources found, return empty response
    if (validSourceIds.length === 0) {
        return {
            results: [],
        };
    }

    // perform vector search on mongodb for similar documents
    // from the sources fetched above
    const agg = [
        {
            '$vectorSearch': {
                'index': 'vector_index',
                'path': 'embeddings',
                'filter': {
                    'sourceId': {
                        '$in': validSourceIds,
                    }
                },
                'queryVector': embedResult.embedding,
                'numCandidates': 5000,
                'limit': k,
            }
        }, {
            '$project': {
                '_id': 0,
                'content': 1,
                'metadata.sourceURL': 1,
                'metadata.title': 1,
                'score': {
                    '$meta': 'vectorSearchScore'
                }
            }
        }
    ];

    // run pipeline
    const embeddingMatches = await embeddingsCollection.aggregate<z.infer<typeof EmbeddingDoc>>(agg).toArray();

    // if return type is chunks, return the chunks
    if (returnType === 'chunks') {
        return {
            results: embeddingMatches.map(m => ({
                title: m.metadata.title,
                content: m.content,
                url: m.metadata.sourceURL,
                score: m.metadata.score,
            })),
        };
    }

    // else return the content of the webpages
    const result: z.infer<typeof GetInformationToolResult> = {
        results: [],
    };

    // coalesce results by url
    const seenUrls = new Set<string>();
    for (const match of embeddingMatches) {
        if (seenUrls.has(match.metadata.sourceURL)) {
            continue;
        }
        seenUrls.add(match.metadata.sourceURL);
        result.results.push({
            title: match.metadata.title,
            content: match.content,
            url: match.metadata.sourceURL,
            score: match.metadata.score,
        });
    }

    // now fetch each webpage content and overwrite 
    for (const res of result.results) {
        try {
            const page = await webpagesCollection.findOne({
                "_id": res.url,
            });
            if (!page) {
                continue;
            }
            res.content = page.contentSimple;
        } catch (e) {
            // console.error('error fetching page:', e);
        }
    }

    return result;
}

export async function toggleDataSource(projectId: string, sourceId: string, active: boolean) {
    await projectAuthCheck(projectId);

    await dataSourcesCollection.updateOne({
        "_id": new ObjectId(sourceId),
        "projectId": projectId,
    }, {
        $set: {
            "active": active,
        }
    });
}

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

export async function simulateUserResponse(
    projectId: string,
    messages: z.infer<typeof apiV1.ChatMessage>[],
    simulationData: z.infer<typeof SimulationData>
): Promise<string> {
    await projectAuthCheck(projectId);
    if (!await check_query_limit(projectId)) {
        throw new QueryLimitError();
    }

    const articlePrompt = `
# Your Specific Task:

## Context:

Here is a help article:

Content:
<START_ARTICLE_CONTENT>
Title: {{title}}
{{content}}
<END_ARTICLE_CONTENT> 

## Task definition:

Pretend to be a user reaching out to customer support. Chat with the
customer support assistant, assuming your issue or query is from this article.
Ask follow-up questions and make it real-world like. Don't do dummy
conversations. Your conversation should be a maximum of 5 user turns.

As output, simply provide your (user) turn of conversation.

After you are done with the chat, keep replying with a single word EXIT
in all capitals.
`;

    const scenarioPrompt = `
# Your Specific Task:

## Context:

Here is a scenario:

Scenario:
<START_SCENARIO>
{{scenario}}
<END_SCENARIO> 

## Task definition:

Pretend to be a user reaching out to customer support. Chat with the
customer support assistant, assuming your issue is based on this scenario.
Ask follow-up questions and make it real-world like. Don't do dummy
conversations. Your conversation should be a maximum of 5 user turns.

As output, simply provide your (user) turn of conversation.

After you are done with the chat, keep replying with a single word EXIT
in all capitals.
`;

    const previousChatPrompt = `
# Your Specific Task:

## Context:

Here is a chat between a user and a customer support assistant:

Chat:
<PREVIOUS_CHAT>
{{messages}}
<END_PREVIOUS_CHAT> 

## Task definition:

Pretend to be a user reaching out to customer support. Chat with the
customer support assistant, assuming your issue based on this previous chat.
Ask follow-up questions and make it real-world like. Don't do dummy
conversations. Your conversation should be a maximum of 5 user turns.

As output, simply provide your (user) turn of conversation.

After you are done with the chat, keep replying with a single word EXIT
in all capitals.
`;
    await projectAuthCheck(projectId);

    // flip message assistant / user message
    // roles from chat messages
    // use only text response messages
    const flippedMessages: { role: 'user' | 'assistant', content: string }[] = messages
        .filter(m => m.role == 'assistant' || m.role == 'user')
        .map(m => ({
            role: m.role == 'assistant' ? 'user' : 'assistant',
            content: m.content || '',
        }));

    // simulate user call
    let prompt;
    if ('articleUrl' in simulationData) {
        prompt = articlePrompt
            .replace('{{title}}', simulationData.articleTitle || '')
            .replace('{{content}}', simulationData.articleContent || '');
    }
    if ('scenario' in simulationData) {
        prompt = scenarioPrompt
            .replace('{{scenario}}', simulationData.scenario);
    }
    if ('chatMessages' in simulationData) {
        prompt = previousChatPrompt
            .replace('{{messages}}', simulationData.chatMessages);
    }
    const { text } = await generateText({
        model: openai("gpt-4o"),
        system: prompt || '',
        messages: flippedMessages,
    });

    return text.replace(/\. EXIT$/, '.');
}

export async function rotateSecret(projectId: string): Promise<string> {
    await projectAuthCheck(projectId);
    const secret = crypto.randomBytes(32).toString('hex');
    await projectsCollection.updateOne(
        { _id: projectId },
        { $set: { secret } }
    );
    return secret;
}

export async function updateWebhookUrl(projectId: string, url: string) {
    await projectAuthCheck(projectId);
    await projectsCollection.updateOne(
        { _id: projectId },
        { $set: { webhookUrl: url } }
    );
}

export async function executeClientTool(
    toolCall: z.infer<typeof apiV1.AssistantMessageWithToolCalls>['tool_calls'][number],
    messages: z.infer<typeof apiV1.ChatMessage>[],
    projectId: string,
): Promise<unknown> {
    await projectAuthCheck(projectId);

    const result = await callClientToolWebhook(toolCall, messages, projectId);
    return result;
}

export async function createApiKey(projectId: string): Promise<WithStringId<z.infer<typeof ApiKey>>> {
    await projectAuthCheck(projectId);

    // count existing keys
    const count = await apiKeysCollection.countDocuments({ projectId });
    if (count >= 3) {
        throw new Error('Maximum number of API keys reached');
    }

    // create key
    const key = crypto.randomBytes(32).toString('hex');
    const doc: z.infer<typeof ApiKey> = {
        projectId,
        key,
        createdAt: new Date().toISOString(),
    };
    await apiKeysCollection.insertOne(doc);
    const { _id, ...rest } = doc as WithStringId<z.infer<typeof ApiKey>>;
    return { ...rest, _id: _id.toString() };
}

export async function deleteApiKey(projectId: string, id: string) {
    await projectAuthCheck(projectId);
    await apiKeysCollection.deleteOne({ projectId, _id: new ObjectId(id) });
}

export async function listApiKeys(projectId: string): Promise<WithStringId<z.infer<typeof ApiKey>>[]> {
    await projectAuthCheck(projectId);
    const keys = await apiKeysCollection.find({ projectId }).toArray();
    return keys.map(k => ({ ...k, _id: k._id.toString() }));
}

export async function updateProjectName(projectId: string, name: string) {
    await projectAuthCheck(projectId);
    await projectsCollection.updateOne({ _id: projectId }, { $set: { name } });
    revalidatePath(`/projects/${projectId}`, 'layout');
}

export async function deleteProject(projectId: string) {
    await projectAuthCheck(projectId);

    // delete api keys
    await apiKeysCollection.deleteMany({
        projectId,
    });

    // delete embeddings
    const sources = await dataSourcesCollection.find({
        projectId,
    }, {
        projection: {
            _id: true,
        }
    }).toArray();

    const ids = sources.map(s => s._id);

    // delete data sources
    await embeddingsCollection.deleteMany({
        sourceId: { $in: ids.map(i => i.toString()) },
    });
    await dataSourcesCollection.deleteMany({
        _id: {
            $in: ids,
        }
    });

    // delete project members
    await projectMembersCollection.deleteMany({
        projectId,
    });

    // delete workflows
    await agentWorkflowsCollection.deleteMany({
        projectId,
    });

    // delete scenarios
    await scenariosCollection.deleteMany({
        projectId,
    });

    // delete project
    await projectsCollection.deleteOne({
        _id: projectId,
    });

    redirect('/projects');
}
