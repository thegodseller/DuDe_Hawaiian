import { Metadata } from "next";
import { App } from "./app";
import { USE_RAG, USE_RAG_UPLOADS, USE_RAG_S3_UPLOADS, USE_RAG_SCRAPING, USE_BILLING } from "@/app/lib/feature_flags";
import { notFound } from "next/navigation";
import { requireActiveBillingSubscription } from '@/app/lib/billing';
import { container } from "@/di/container";
import { getEligibleModels } from "@/app/lib/billing";
import { ModelsResponse } from "@/app/lib/types/billing_types";
import { requireAuth } from "@/app/lib/auth";
import { IFetchProjectController } from "@/src/interface-adapters/controllers/projects/fetch-project.controller";
import { IListDataSourcesController } from "@/src/interface-adapters/controllers/data-sources/list-data-sources.controller";
import { z } from "zod";

const fetchProjectController = container.resolve<IFetchProjectController>('fetchProjectController');
const listDataSourcesController = container.resolve<IListDataSourcesController>('listDataSourcesController');

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
    const user = await requireAuth();
    const customer = await requireActiveBillingSubscription();
    console.log('->>> workflow page being rendered');

    const project = await fetchProjectController.execute({
        caller: "user",
        userId: user.id,
        projectId: params.projectId,
    });
    if (!project) {
        notFound();
    }

    const sources = await listDataSourcesController.execute({
        caller: "user",
        userId: user.id,
        projectId: params.projectId,
    });

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
