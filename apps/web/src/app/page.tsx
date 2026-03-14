import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl font-bold">HVAC SaaS</h1>
      <p className="text-muted-foreground">
        Field service management for HVAC contractors
      </p>
      <div className="flex gap-4">
        <Link href="/login">
          <Button>Sign in</Button>
        </Link>
        <Link href="/signup">
          <Button variant="outline">Sign up</Button>
        </Link>
      </div>
    </div>
  );
}
