import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "../../_components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell title="Make it" fancy="make sense.">
      <SignUp />
    </AuthShell>
  );
}
