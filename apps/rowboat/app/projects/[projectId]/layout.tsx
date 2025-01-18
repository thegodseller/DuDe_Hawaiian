import { Nav } from "./nav";

export default async function Layout({
    params,
    children
}: {
    params: { projectId: string }
    children: React.ReactNode
}) {
    return <div className="flex h-full">
        <Nav projectId={params.projectId} />
        <div className="grow p-4 overflow-auto bg-white rounded-tl-lg">
            {children}
        </div>
    </div >;
}