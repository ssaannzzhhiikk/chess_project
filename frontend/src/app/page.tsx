import { AppLayout } from "@/components/layout/app-layout";
import { LandingPage } from "@/features/marketing/landing-page";

export default function Home() {
  return (
    <AppLayout>
      <LandingPage />
    </AppLayout>
  );
}
