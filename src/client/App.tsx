import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PublicPerson } from "../shared/api";
import { request } from "./api";
import { BookingWidget } from "./booking/BookingWidget";
import { ManageBooking } from "./manage/ManageBooking";

const AdminCalendar = lazy(() => import("./admin/AdminCalendar"));

export function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <Route />
      <Toaster position="bottom-center" />
    </TooltipProvider>
  );
}

function Route() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "admin") {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-shell" />}>
        <AdminCalendar />
      </Suspense>
    );
  }
  if (parts[0] === "b" && parts[1]) return <ManageBooking token={parts[1]} />;
  return <PersonRoute slug={parts.length === 1 ? parts[0] : parts.length === 0 ? null : undefined} />;
}

/** The booking page. Who can be booked comes from the server, so their calendars never reach the browser. */
function PersonRoute({ slug }: { slug: string | null | undefined }) {
  const [people, setPeople] = useState<PublicPerson[] | "error" | null>(null);

  useEffect(() => {
    if (slug === undefined) return;
    request<PublicPerson[]>("/api/p")
      .then(setPeople)
      .catch(() => setPeople("error"));
  }, [slug]);

  if (slug !== undefined && people === null) return <div className="min-h-dvh bg-shell" />;
  if (people === "error") {
    return (
      <Notice>
        Sidan gick inte att ladda.{" "}
        <a className="text-primary underline" href={location.href}>
          Försök igen
        </a>
      </Notice>
    );
  }
  const person = slug ? people?.find((p) => p.slug === slug) : undefined;
  if (person) return <BookingWidget person={person} />;
  // The root goes to the only bookable person for now.
  if (slug === null && people?.length === 1) {
    history.replaceState(null, "", `/${people[0].slug}${location.search}`);
    return <BookingWidget person={people[0]} />;
  }
  return (
    <Notice>
      Sidan finns inte. <a className="text-primary underline" href="/">Till bokningen</a>
    </Notice>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-shell p-6 text-muted-foreground">
      <p>{children}</p>
    </main>
  );
}
