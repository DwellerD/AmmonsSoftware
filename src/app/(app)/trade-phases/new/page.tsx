import { Suspense } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { TradePhaseForm } from "@/components/forms/TradePhaseForm";

/** Page wrapper for creating a new trade phase. */
export default function NewTradePhasePage() {
  return (
    <PageContainer>
      <PageHeader
        title="New trade phase"
        description="Track a specific piece of work from readiness to approval."
        action={
          <Link href="/trade-phases">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />
      {/* useSearchParams() inside the form needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState message="Loading form…" />}>
        <TradePhaseForm />
      </Suspense>
    </PageContainer>
  );
}
