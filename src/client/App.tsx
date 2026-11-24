import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PEOPLE } from "../shared/config";
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
  if (parts[0] && Object.hasOwn(PEOPLE, parts[0])) return <BookingWidget slug={parts[0]} />;
  // The root goes to the only bookable person for now.
  if (parts.length === 0) {
    const only = Object.keys(PEOPLE);
    if (only.length === 1) {
      history.replaceState(null, "", `/${only[0]}${location.search}`);
      return <BookingWidget slug={only[0]} />;
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-shell p-6 text-muted-foreground">
      <p>
        Sidan finns inte. <a className="text-primary underline" href="/">Till bokningen</a>
      </p>
    </main>
  );
}
