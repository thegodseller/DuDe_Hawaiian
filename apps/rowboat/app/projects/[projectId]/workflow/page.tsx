import { Metadata } from "next";
import { App } from "./app";
import { USE_RAG, USE_RAG_UPLOADS, USE_RAG_S3_UPLOADS, USE_RAG_SCRAPING, USE_BILLING } from "@/app/lib/feature_flags";
import { notFound } from "next/navigation";
import { requireActiveBillingSubscription } from '@/app/lib/billing';
import { container } from "@/di/container";
import { IProjectsRepository } from "@/src/application/repositories/projects.repository.interface";
import { IDataSourcesRepository } from "@/src/application/repositories/data-sources.repository.interface";
import { getEligibleModels } from "@/app/lib/billing";
import { ModelsResponse } from "@/app/lib/types/billing_types";
import { z } from "zod";

const projectsRepository = container.resolve<IProjectsRepository>('projectsRepository');
const dataSourceRepository = container.resolve<IDataSourcesRepository>('dataSourcesRepository');

const DEFAULT_MODEL = process.env.PROVIDER_DEFAULT_MODEL || "gpt-4.1";

export const metadata: Metadata = {
    title: "Workflow"
}

export default async function Page(
    props: {
        params: Promise<{ projectId: string }>;
    }
) {
    const params = await props.params;
    const customer = await requireActiveBillingSubscription();
    console.log('->>> workflow page being rendered');
    const project = await projectsRepository.fetch(params.projectId);
    if (!project) {
        notFound();
    }

    const sources = [];
    let cursor = undefined;
    do {
        const result = await dataSourceRepository.list(project.id, undefined, cursor);
        sources.push(...result.items);
        cursor = result.nextCursor;
    } while (cursor);

    let eligibleModels: z.infer<typeof ModelsResponse> | "*" = '*';
    if (USE_BILLING) {
        eligibleModels = await getEligibleModels(customer._id);
    }

    console.log('/workflow page.tsx serve');

    return (
        <App
            initialProjectData={project}
            initialDataSources={sources}
            eligibleModels={eligibleModels}
            useRag={USE_RAG}
            useRagUploads={USE_RAG_UPLOADS}
            useRagS3Uploads={USE_RAG_S3_UPLOADS}
            useRagScraping={USE_RAG_SCRAPING}
            defaultModel={DEFAULT_MODEL}
            chatWidgetHost={process.env.CHAT_WIDGET_HOST || ''}
        />
    );
}
