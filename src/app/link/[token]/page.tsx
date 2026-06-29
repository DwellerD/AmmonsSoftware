"use client";

import { useParams } from "next/navigation";
import { ContractorLinkClient } from "@/components/contractor/ContractorLinkClient";

/**
 * Public contractor action link page. Lives outside the (app) group so it has
 * no GC navigation shell and requires no account — the token in the URL is the
 * only thing needed to open it.
 */
export default function ContractorLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  return <ContractorLinkClient token={token} />;
}
