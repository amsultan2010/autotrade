import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/src/components/AuthShell';

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border-0 bg-transparent p-0',
            headerTitle: 'font-display',
            formButtonPrimary:
              'bg-accent text-bg hover:bg-accent-hover rounded-lg font-semibold shadow-sm',
          },
        }}
      />
    </AuthShell>
  );
}
