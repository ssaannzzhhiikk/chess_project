import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/features/auth/login-page";

export default function Login() {
  return (
    <AppLayout footer={false}>
      <LoginPage />
    </AppLayout>
  );
}
