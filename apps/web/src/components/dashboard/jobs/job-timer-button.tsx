"use client";

import { useState } from "react";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useRunningTimer,
  useStartJobTimer,
  useStopJobTimer,
} from "@/hooks/queries";
import { ElapsedTime } from "@/components/dashboard/reusable/elapsed-time";

interface JobTimerButtonProps {
  jobId: string;
  size?: "sm" | "default";
}

/**
 * Start / Stop for one job.
 *
 * Three states, because there are genuinely three: no timer, my timer on *this*
 * job, and my timer on a *different* job. The third is the one worth handling
 * properly — the database permits one running timer per person, so pressing
 * Start here while clocked in elsewhere is a refusal. Asking first turns that
 * into a decision the user makes rather than an error they read.
 */
export function JobTimerButton({ jobId, size = "default" }: JobTimerButtonProps) {
  const { data } = useRunningTimer();
  const running = data?.data ?? null;

  const start = useStartJobTimer(jobId);
  const stop = useStopJobTimer(jobId);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const runningHere = running?.jobId === jobId;
  const runningElsewhere = running !== null && !runningHere;
  const pending = start.isPending || stop.isPending;

  function handleSwitch() {
    // Stop first, then start. Sequential on purpose: the partial unique index
    // means the start would be refused while the other timer is still open, so
    // firing both at once would lose the race about half the time.
    stop.mutate(undefined, {
      onSuccess: (res) => {
        setConfirmSwitch(false);
        if (!res.error) start.mutate(undefined);
      },
    });
  }

  if (runningHere) {
    return (
      <Button
        size={size}
        variant="outline"
        disabled={pending}
        onClick={() => stop.mutate(undefined)}
        className="cursor-pointer border-brand/40 text-brand hover:bg-brand/10 hover:text-brand"
      >
        <IconPlayerStop className="mr-1.5 h-4 w-4" aria-hidden />
        Stop
        <ElapsedTime
          since={running.startedAt}
          className="tnum ml-2 font-mono text-xs opacity-80"
        />
      </Button>
    );
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        disabled={pending}
        onClick={() =>
          runningElsewhere ? setConfirmSwitch(true) : start.mutate(undefined)
        }
        className="cursor-pointer"
      >
        <IconPlayerPlay className="mr-1.5 h-4 w-4" aria-hidden />
        Start timer
      </Button>

      <AlertDialog open={confirmSwitch} onOpenChange={setConfirmSwitch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch your timer to this job?</AlertDialogTitle>
            <AlertDialogDescription>
              You are clocked in on job {running?.jobNumber} — {running?.jobTitle}
              . Starting here stops that timer and logs the time it has run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Keep the current timer
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // The dialog closes itself on action, which would unmount the
                // pending state before the two requests finish. Held open until
                // the stop resolves so a slow network cannot look like a no-op.
                e.preventDefault();
                handleSwitch();
              }}
              disabled={pending}
              className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {pending ? "Switching…" : "Switch to this job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
