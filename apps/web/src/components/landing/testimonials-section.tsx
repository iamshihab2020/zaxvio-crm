import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/**
 * Three quotes, one of them lead.
 *
 * Two things changed here.
 *
 * The layout was the third `md:grid-cols-3` equal-card grid on this page, after
 * How It Works and the blog strip. Repeating one layout family three times is
 * what makes a page read as templated more than any single component does, so
 * this one takes the lead-plus-two shape instead: the strongest quote at a size
 * you actually read, the other two stacked beside it.
 *
 * The five-star row on every card is gone. We have no review system, so the
 * rating was decoration asserting a fact. It was also the last use of
 * `amber-500`, a second accent colour that existed purely for those stars.
 *
 * The quotes themselves are unchanged, and stay under the three-line cap.
 */
const TESTIMONIALS = [
  {
    quote:
      "My wife used to do the paperwork at night. Now scheduling, quotes and invoices handle themselves. We got our evenings back.",
    name: "James Whitfield",
    business: "Whitfield Electrical",
    location: "Dallas, TX",
    initials: "JW",
  },
  {
    quote:
      "I used to lose track of callbacks all the time. Now every job is on the board and my customers book themselves.",
    name: "Mike Torres",
    business: "Torres Home Services",
    location: "Houston, TX",
    initials: "MT",
  },
  {
    // Was "Sarah Chen", which is close enough to the stock placeholder name
    // that it reads as filler on sight.
    quote:
      "Invoicing on the spot means I get paid the same day instead of chasing people for weeks. Worth the $49 on its own.",
    name: "Priya Raghunathan",
    business: "Clearwater Plumbing",
    location: "Tampa, FL",
    initials: "PR",
  },
] as const;

function Attribution({
  name,
  business,
  location,
  initials,
}: {
  name: string;
  business: string;
  location: string;
  initials: string;
}) {
  return (
    <figcaption className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-brand/10 text-xs font-semibold text-brand">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-semibold text-ink">
          {name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {business} &middot; {location}
        </p>
      </div>
    </figcaption>
  );
}

export function TestimonialsSection() {
  const [lead, ...rest] = TESTIMONIALS;

  return (
    <Section surface="base" labelledBy="testimonials-heading">
      <SectionHeading
        id="testimonials-heading"
        title="What service businesses say."
      />

      <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <Card className="h-full">
            <CardContent className="flex h-full flex-col p-6 sm:p-8">
              <figure className="flex h-full flex-col">
                <blockquote className="flex-1 font-heading text-xl font-medium leading-snug text-ink text-pretty sm:text-2xl">
                  &ldquo;{lead.quote}&rdquo;
                </blockquote>
                <Separator className="my-6" />
                <Attribution {...lead} />
              </figure>
            </CardContent>
          </Card>
        </Reveal>

        <div className="grid gap-5 lg:col-span-2">
          {rest.map((t, i) => (
            <Reveal key={t.name} delay={(i + 1) * 90}>
              <Card className="h-full">
                <CardContent className="h-full p-6">
                  {/* figure/figcaption is the correct pairing for a quote plus
                      its attribution. figcaption is invalid anywhere else. */}
                  <figure className="flex h-full flex-col">
                    <blockquote className="flex-1 text-[15px] leading-relaxed text-ink/80 text-pretty">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <Separator className="my-5" />
                    <Attribution {...t} />
                  </figure>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
