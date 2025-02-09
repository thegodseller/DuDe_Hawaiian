import { SourcePage } from "./source-page";

export default async function Page({
    params,
}: {
    params: {
        projectId: string,
        sourceId: string
    }
}) {
    return <SourcePage projectId={params.projectId} sourceId={params.sourceId} />;
}