"use client";

import { useState, useTransition } from "react";
import { IconCheck, IconMailOff, IconAlertTriangle } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  confirmUnsubscribe,
  type UnsubscribeTarget,
} from "@/actions/public-unsubscribe";

interface UnsubscribeClientProps {
  token: string;
  target: UnsubscribeTarget | null;
  notFound: boolean;
  loadError: string | null;
}

/**
 * Three states, and keeping them distinct is the whole job.
 *
 * A bad link, an outage and a successful unsubscribe must not look alike:
 * someone here is trying to make email stop, and telling them "this link is
 * invalid" when the API is merely down is the most annoying possible failure.
 * That is QUO-07 — a 500 rendered as "this estimate does not exist" — in a
 * place where the reader has less patience and no account to check.
 */
export function UnsubscribeClient({
  token,
  target,
  notFound,
  loadError,
}: UnsubscribeClientProps) {
  const [done, setDone] = useState(target?.alreadyOptedOut ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (notFound) {
    return (
      <Shell
        icon={<IconAlertTriangle className="size-6 text-muted-foreground" />}
        title="This link has expired"
        description="We couldn't match this unsubscribe link to a record. If you're still getting emails you don't want, reply to any of them and ask to be removed — a person will see it."
      />
    );
  }

  if (loadError || !target) {
    return (
      <Shell
        icon={<IconAlertTriangle className="size-6 text-muted-foreground" />}
        title="Something went wrong"
        description={
          loadError ??
          "We couldn't load this page. Please try again in a moment — your link is still valid."
        }
      />
    );
  }

  if (done) {
    return (
      <Shell
        icon={<IconCheck className="size-6 text-emerald-600" />}
        title="You're unsubscribed"
        description={`${target.businessName} will no longer send you marketing or reminder emails.`}
      >
        {/* Said plainly and up front, because the alternative is a support
            email in three days asking why an invoice arrived. */}
        <p className="text-sm text-muted-foreground">
          You may still receive emails about work you&rsquo;ve booked — an
          estimate you asked for, an invoice, or a receipt.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<IconMailOff className="size-6 text-muted-foreground" />}
      title="Unsubscribe from these emails?"
      description={
        target.email
          ? `Stop marketing and reminder emails from ${target.businessName} to ${target.email}.`
          : `Stop marketing and reminder emails from ${target.businessName}.`
      }
      footer={
        <div className="flex w-full flex-col gap-3">
          <Button
            className="w-full"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await confirmUnsubscribe(token);
                if (result.ok) setDone(true);
                else setError(result.error);
              });
            }}
          >
            {isPending ? "Unsubscribing…" : "Unsubscribe"}
          </Button>
          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        You&rsquo;ll still get emails about work you&rsquo;ve booked — estimates,
        invoices and receipts.
      </p>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  description,
  children,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
