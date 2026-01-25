import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Join The Collectors System
            </h1>
            <p className="text-muted-foreground mt-2">
              Create your account to get started
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
