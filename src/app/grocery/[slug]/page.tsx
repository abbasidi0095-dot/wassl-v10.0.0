import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Grocery storefronts live on the main /store/[slug] route. */
export default async function GroceryStoreRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/store/${slug}`);
}
