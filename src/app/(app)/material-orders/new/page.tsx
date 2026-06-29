import { Suspense } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { MaterialOrderForm } from "@/components/forms/MaterialOrderForm";

/** Page wrapper for creating a new material order. */
export default function NewMaterialOrderPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New material order"
        description="Track what's been ordered for a project and where it stands."
        action={
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        }
      />
      {/* useSearchParams() inside the form needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState message="Loading form…" />}>
        <MaterialOrderForm />
      </Suspense>
    </PageContainer>
  );
}
