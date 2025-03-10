import { Nav } from "./nav";
import { USE_RAG } from "@/app/lib/feature_flags";

export default async function Layout({
    params,
    children
}: {
    params: { projectId: string }
    children: React.ReactNode
}) {
    const useRag = USE_RAG;

    return <div className="flex h-full">
        <Nav projectId={params.projectId} useRag={useRag} />
        <div className="grow p-2 overflow-auto bg-background dark:bg-background rounded-tl-lg">
            {children}
        </div>
    </div>;
}