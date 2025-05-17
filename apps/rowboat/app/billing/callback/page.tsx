import { syncWithStripe } from "@/app/lib/billing";
import { requireBillingCustomer } from '@/app/lib/billing';
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Page({
    searchParams,
}: {
    searchParams: {
        redirect: string;
    }
}) {
    const customer = await requireBillingCustomer();
    await syncWithStripe(customer._id);
    const redirectUrl = searchParams.redirect as string;
    redirect(redirectUrl || '/projects');
}