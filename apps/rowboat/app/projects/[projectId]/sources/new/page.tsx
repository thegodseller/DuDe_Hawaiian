import { Metadata } from "next";
import { Form } from "./form";
import { redirect } from "next/navigation";
import { USE_RAG, USE_RAG_UPLOADS, USE_RAG_SCRAPING } from "../../../../lib/feature_flags";

export const metadata: Metadata = {
    title: "Add data source"
}

export default async function Page({
    params
}: {
    params: { projectId: string }
}) {
    if (!USE_RAG) {
        redirect(`/projects/${params.projectId}`);
    }

    return <div className="flex flex-col h-full">
        <div className="shrink-0 flex justify-between items-center pb-4 border-b border-border">
            <div className="flex flex-col">
                <h1 className="text-lg">Add data source</h1>
            </div>
        </div>
        <Form
            projectId={params.projectId}
            useRagUploads={USE_RAG_UPLOADS}
            useRagScraping={USE_RAG_SCRAPING}
        />
    </div>;
}