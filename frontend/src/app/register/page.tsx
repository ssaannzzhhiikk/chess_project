import { AppLayout } from "@/components/layout/app-layout";
import { RegisterPage } from "@/features/auth/register-page";

export default function Register() {
  return (
    <AppLayout footer={false}>
      <RegisterPage />
    </AppLayout>
  );
}
