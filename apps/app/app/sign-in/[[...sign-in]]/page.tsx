import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "../../_components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell title="Welcome" fancy="back.">
      <SignIn />
    </AuthShell>
  );
}
