import { Input } from "@nextui-org/react";
import { createProject } from "@/app/actions";
import { Submit } from "./submit";

export default async function Page() {
    return <div className="h-full pt-4 px-4 overflow-auto">
        <div className="max-w-[768px] mx-auto p-4 bg-white rounded-lg">
            <div className="text-lg pb-2 border-b border-b-gray-100">Create new Project</div>
            <form className="mt-4 flex flex-col gap-4" action={createProject}>
                <Input
                    required
                    name="name"
                    label="Name this project:"
                    placeholder="Project name or description (internal only)"
                    variant="bordered"
                    labelPlacement="outside"
                />
                <Submit />
            </form>
        </div>
    </div>;
}