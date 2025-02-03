import { Metadata } from "next";
import { App } from "./app";

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
    />;
}
