import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/src/components/AuthShell';

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
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
