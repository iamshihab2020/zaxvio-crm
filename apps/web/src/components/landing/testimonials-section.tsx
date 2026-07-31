import { IconStarFilled } from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const TESTIMONIALS = [
  {
    quote:
      "I used to lose track of callbacks all the time. Now every job is on the board and my customers book themselves.",
    name: "Mike Torres",
    business: "Torres Home Services",
    location: "Houston, TX",
    initials: "MT",
  },
  {
    quote:
      "Invoicing on the spot means I get paid the same day instead of chasing people for weeks. Worth the $49 on its own.",
    name: "Sarah Chen",
    business: "ClearFlow Plumbing",
    location: "Tampa, FL",
    initials: "SC",
  },
  {
    quote:
      "My wife used to do the paperwork at night. Now scheduling, quotes and invoices handle themselves. We got our evenings back.",
    name: "James Whitfield",
    business: "BrightSpark Electrical",
    location: "Dallas, TX",
    initials: "JW",
  },
] as const;

export function TestimonialsSection() {
  return (
    <Section surface="base" labelledBy="testimonials-heading">
      <SectionHeading
        id="testimonials-heading"
        label="Customers"
        title="What service businesses say."
      />

      <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 90}>
            <Card className="h-full">
              <CardContent className="h-full p-6">
                {/* figure/figcaption is the correct pairing for a quote plus
                    its attribution — figcaption is invalid anywhere else. */}
                <figure className="flex h-full flex-col">
                  <div className="flex gap-0.5" aria-label="Rated 5 out of 5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <IconStarFilled
                        key={j}
                        size={13}
                        className="text-amber-500"
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink/80 text-pretty">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  <Separator className="my-5" />

                  <figcaption className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-brand/10 text-xs font-semibold text-brand">
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm font-semibold text-ink">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.business} &middot; {t.location}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
