"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { DocumentUploadForm } from "@/components/forms/DocumentUploadForm";
import { useAuth } from "@/components/providers/AuthProvider";

/** Page wrapper for uploading a new project document (GC / internal team). */
export default function NewDocumentPage() {
  const router = useRouter();
  const { canManage } = useAuth();

  return (
    <PageContainer>
      <PageHeader
        title="Upload document"
        description="Add a blueprint, contract, invoice, permit, or other project file."
        action={
          <Link href="/documents">
            <Button variant="outline">Back to vault</Button>
          </Link>
        }
      />

      {canManage ? (
        <DocumentUploadForm onUploaded={() => router.push("/documents")} />
      ) : (
        <EmptyState
          title="Not available"
          description="Only the GC or internal team can upload documents."
        />
      )}
    </PageContainer>
  );
}
