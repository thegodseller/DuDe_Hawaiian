'use client';

import { Pagination as NextUiPagination } from "@nextui-org/react";
import { usePathname, useRouter } from "next/navigation";

export function Pagination({
    total,
    page,
}: {
    total: number;
    page: number;
}) {
    const pathname = usePathname();
    const router = useRouter();

    return <NextUiPagination
        showControls
        total={total}
        initialPage={page}
        onChange={(page) => {
            router.push(`${pathname}?page=${page}`);
        }}
    />;
}