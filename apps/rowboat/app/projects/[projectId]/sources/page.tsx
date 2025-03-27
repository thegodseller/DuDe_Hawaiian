import { Metadata } from "next";
import { SourcesList } from "./components/sources-list";

export const metadata: Metadata = {
    title: "Data sources",
}

export default async function Page({
    params,
}: {
    params: { projectId: string }
}) {
    return <SourcesList 
        projectId={params.projectId} 
    />;
}