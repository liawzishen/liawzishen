import { FarmSetupProvider } from "@/contexts/farm-setup-context";

/** Wraps all three wizard steps so they share one in-memory state. */
export default function NewFarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FarmSetupProvider>{children}</FarmSetupProvider>;
}
