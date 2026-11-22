import { SignIn } from "@/components/auth/sign-in";
import { LiveSignIn } from "@/components/auth/live-sign-in";
import { isDemo } from "@/lib/config";

export default function SignInPage() {
  return isDemo ? <SignIn /> : <LiveSignIn />;
}
