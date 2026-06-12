import { getRepo } from "@/lib/repo";
import type { Business, Repo } from "@/lib/types";

/** Active tenant for this MVP deployment. Multi-tenant routing (by host/slug)
 *  is a fast-follow; the domain is already fully tenant-scoped. */
export const ACTIVE_SLUG = process.env.BUSINESS_SLUG || "paws-and-care";

export async function loadContext(): Promise<{ repo: Repo; business: Business }> {
  const repo = getRepo();
  const business = await repo.getBusinessBySlug(ACTIVE_SLUG);
  if (!business) throw new Error(`No business configured for slug "${ACTIVE_SLUG}"`);
  return { repo, business };
}
