import { Metadata } from "next";
import { App } from "./app";
import { USE_RAG } from "@/app/lib/feature_flags";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: "Workflow"
}

export default async function Page({
    params,
}: {
    params: { projectId: string };
}) {
    return <App
        projectId={params.projectId}
        useRag={USE_RAG}
    />;
}
