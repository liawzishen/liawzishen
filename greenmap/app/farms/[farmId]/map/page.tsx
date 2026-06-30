import { redirect } from "next/navigation";

/**
 * The Map tab now opens the farm's interactive map directly. This route used
 * to render a second "Your Farms" list, which duplicated the post-login
 * selector — so it just forwards to the field/map view. Switching farms now
 * happens via the FarmSwitcher in the header.
 */
export default async function FarmMapRedirect({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  redirect(`/farms/${farmId}/field`);
}
