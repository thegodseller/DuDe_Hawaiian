import { Metadata } from "next";
import { Form } from "./form";

export const metadata: Metadata = {
    title: "Add data source"
}

export default async function Page({
    params
}: {
    params: { projectId: string }
}) {
    return <div className="flex flex-col h-full">
        <div className="shrink-0 flex justify-between items-center pb-4 border-b border-b-gray-100">
            <div className="flex flex-col">
                <h1 className="text-lg">Add data source</h1>
            </div>
        </div>
        <Form projectId={params.projectId} />
    </div>;
}