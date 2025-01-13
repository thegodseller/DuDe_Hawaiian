'use client';
import { FormStatusButton } from "@/app/lib/components/FormStatusButton";
import { useFormStatus } from "react-dom";

export function Submit() {
    const { pending } = useFormStatus();

    return <>
        {pending && <div className="text-gray-400">Please hold on while we set up your project&hellip;</div>}
        <FormStatusButton
            props={{
                type: "submit",
                children: "Create",
                className: "self-start",
                startContent: <svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                </svg>,
            }}
        />
    </>;
}