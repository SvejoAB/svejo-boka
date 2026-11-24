import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Globe, Mail, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { enGB, sv } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { dateFromKey, keyFromDate, LangSwitch, PersonAvatar } from "@/components/app";
import { cn } from "@/lib/utils";
import type { BookingRequest, BookingResult, Lang, PublicAvailability, PublicPerson } from "../../shared/api";
import { swedishHoliday } from "../../shared/holidays";
import { request, RequestError } from "../api";
import { capitalize, clock, longDay, useLang, type Strings } from "../i18n";

type Step = { kind: "pick" } | { kind: "form"; slot: number } | { kind: "done"; result: BookingResult };
type MsgKey = "errName" | "errEmail" | "errPhone" | "errMessage" | "errLimit" | "errGeneric" | "errTaken";

export function BookingWidget({ person }: { person: PublicPerson }) {
  const { lang, t, toggle } = useLang();
  const slug = person.slug;
  const [data, setData] = useState<PublicAvailability | null>(null);
  const [loadError, setLoadError] = useState<"generic" | "not_connected" | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | undefined>(undefined);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [notice, setNotice] = useState<MsgKey | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const d = await request<PublicAvailability>(`/api/p/${slug}/availability`);
      setData(d);
      const firstFree = d.days.find((x) => x.slots.length > 0)?.date ?? null;
      setDate((cur) => (cur && d.days.some((x) => x.date === cur && x.slots.length) ? cur : firstFree));
      setMonth((cur) => cur ?? dateFromKey(firstFree ?? d.today));
    } catch (err) {
      setLoadError(err instanceof RequestError && err.code === "not_connected" ? "not_connected" : "generic");
    }
  }, [slug]);

  useEffect(() => {
    document.title = lang === "sv" ? `Boka ett möte med ${person.name}` : `Book a meeting with ${person.name}`;
  }, [lang, person.name]);

  useEffect(() => {
    void load();
  }, [load]);

  const slotsByDate = useMemo(() => new Map(data?.days.map((d) => [d.date, d.slots]) ?? []), [data]);
  const bookableDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.slots.length > 0).map((d) => dateFromKey(d.date)),
    [data],
  );
  const anyFree = bookableDays.length > 0;
  const length = data?.meetingLength ?? person.meetingLength;

  function changeMonth(next: Date) {
    setMonth(next);
    setNotice(null);
    const prefix = keyFromDate(next).slice(0, 7);
    const first = data?.days.find((d) => d.date.startsWith(prefix) && d.slots.length > 0);
    setDate(first?.date ?? null);
  }

  const aside = (
    <aside className="flex flex-col gap-5 border-b p-6 md:border-r md:border-b-0">
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} />
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{person.name}</p>
      </div>
      <h1 className="text-2xl font-normal tracking-tight">{t.title}</h1>
      <ul className="grid gap-3 text-sm text-muted-foreground">
        <li className="flex items-center gap-3">
          <Clock className="size-5 shrink-0" aria-hidden />
          {t.meetingLength(length)}
        </li>
        <li className="flex items-center gap-3">
          <Video className="size-5 shrink-0" aria-hidden />
          {t.meetLong}
        </li>
        <li className="flex items-center gap-3">
          <Globe className="size-5 shrink-0" aria-hidden />
          {t.timezone} (Stockholm)
        </li>
      </ul>
      {step.kind === "form" && (
        <div className="rounded-lg bg-secondary p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            {capitalize(longDay(step.slot, lang))}
          </p>
          <p className="mt-1 pl-6 tabular-nums">
            {clock(step.slot)}–{clock(step.slot + length * 60000)}
          </p>
        </div>
      )}
      <div className="-ml-3 md:mt-auto">
        <LangSwitch label={t.language} title={t.languageLabel} onClick={toggle} />
      </div>
    </aside>
  );

  let main: React.ReactNode;
  if (loadError) {
    main = (
      <Message
        title={loadError === "not_connected" ? t.notConnected : t.loadError}
        action={
          loadError === "generic" ? (
            <Button variant="outline" onClick={() => void load()}>
              {t.retry}
            </Button>
          ) : null
        }
      />
    );
  } else if (!data || !month) {
    main = <Loading label={t.loading} />;
  } else if (!anyFree) {
    main = (
      <Message
        title={t.emptyTitle}
        body={t.emptyBody(person.name.split(" ")[0])}
        action={
          <Button variant="outline" asChild>
            <a href={`mailto:${person.email}`}>{t.mailInstead}</a>
          </Button>
        }
      />
    );
  } else if (step.kind === "form") {
    main = (
      <BookingForm
        slug={slug}
        slot={step.slot}
        t={t}
        lang={lang}
        onBack={() => setStep({ kind: "pick" })}
        onDone={(result) => setStep({ kind: "done", result })}
        onTaken={() => {
          setNotice("errTaken");
          setStep({ kind: "pick" });
          void load();
        }}
      />
    );
  } else {
    const first = data.days[0]?.date;
    const last = data.days.at(-1)?.date;
    const holiday = date ? swedishHoliday(date) : undefined;
    main = (
      <div className="grid gap-6 lg:grid-cols-[auto_minmax(12rem,1fr)]">
        <div>
          <h2 className="mb-3 text-base font-medium">{t.pickTime}</h2>
          {notice && (
            <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t[notice]}
            </p>
          )}
          <Calendar
            mode="single"
            locale={lang === "sv" ? sv : enGB}
            weekStartsOn={1}
            month={month}
            onMonthChange={changeMonth}
            startMonth={first ? dateFromKey(first) : undefined}
            endMonth={last ? dateFromKey(last) : undefined}
            selected={date ? dateFromKey(date) : undefined}
            onSelect={(d) => {
              if (!d) return;
              setNotice(null);
              setDate(keyFromDate(d));
            }}
            disabled={(d) => !slotsByDate.get(keyFromDate(d))?.length}
            modifiers={{ bookable: bookableDays }}
            modifiersClassNames={{
              bookable:
                "[&>button]:font-semibold [&>button]:text-primary [&>button]:bg-secondary [&>button[data-selected-single=true]]:bg-primary [&>button[data-selected-single=true]]:text-primary-foreground",
            }}
            className="-ml-1 p-0 [--cell-size:--spacing(10)]"
          />
        </div>
        <div className="min-w-0">
          {date ? (
            <>
              <h2 className="text-base font-medium">{capitalize(longDay(dateFromKey(date).getTime(), lang))}</h2>
              {holiday && <p className="text-sm text-muted-foreground">{lang === "sv" ? holiday.name : holiday.nameEn}</p>}
              <div
                className="mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]"
                role="list"
                aria-label={t.pickTime}
              >
                {(slotsByDate.get(date) ?? []).map((s) => (
                  <Button
                    key={s}
                    role="listitem"
                    variant="outline"
                    className="h-11 w-full border-input font-medium text-primary tabular-nums hover:border-primary hover:bg-secondary hover:text-primary"
                    aria-label={`${clock(s)}–${clock(s + length * 60000)}`}
                    onClick={() => {
                      setNotice(null);
                      setStep({ kind: "form", slot: s });
                    }}
                  >
                    {clock(s)}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.pickDay}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-shell px-3 py-6 sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <Card className="mx-auto w-full max-w-[58rem] gap-0 overflow-hidden py-0 shadow-sm">
        {step.kind === "done" ? (
          <Confirmation
            result={step.result}
            t={t}
            lang={lang}
            personName={person.name}
            onLang={toggle}
            onAnother={() => {
              setStep({ kind: "pick" });
              void load();
            }}
          />
        ) : (
          <div className="grid md:grid-cols-[18.5rem_1fr]">
            {aside}
            <section className="min-w-0 p-6">{main}</section>
          </div>
        )}
      </Card>
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{6,24}$/;
type Field = "name" | "email" | "phone" | "message";
type Errors = Partial<Record<Field | "form", MsgKey>>;

function BookingForm(props: {
  slug: string;
  slot: number;
  t: Strings;
  lang: Lang;
  onBack: () => void;
  onDone: (r: BookingResult) => void;
  onTaken: () => void;
}) {
  const { t } = props;
  const [values, setValues] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (k !== "website" && errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  function validate(): Errors {
    const e: Errors = {};
    if (!values.name.trim()) e.name = "errName";
    if (!EMAIL.test(values.email.trim())) e.email = "errEmail";
    const digits = values.phone.replace(/\D/g, "").length;
    if (!PHONE.test(values.phone.trim()) || digits < 6) e.phone = "errPhone";
    if (values.message.length > 1000) e.message = "errMessage";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const body: BookingRequest = {
        start: props.slot,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        message: values.message.trim(),
        lang: props.lang,
        website: values.website,
      };
      props.onDone(await request<BookingResult>(`/api/p/${props.slug}/book`, { method: "POST", body }));
    } catch (err) {
      setBusy(false);
      if (err instanceof RequestError && err.code === "slot_taken") return props.onTaken();
      if (err instanceof RequestError && err.code === "limit") return setErrors({ form: "errLimit" });
      if (err instanceof RequestError && err.code === "invalid" && ["name", "email", "phone", "message"].includes(err.message)) {
        const key = err.message as Field;
        const msg = ({ name: "errName", email: "errEmail", phone: "errPhone", message: "errMessage" } as const)[key];
        return setErrors({ [key]: msg });
      }
      setErrors({ form: "errGeneric" });
    }
  }

  const field = (name: Field, label: string, input: React.ReactNode, hint?: string, optional?: boolean) => {
    const err = errors[name];
    return (
      <div className="grid gap-2">
        <Label htmlFor={`f-${name}`}>
          {label}
          {optional && <span className="font-normal text-muted-foreground">({t.optional})</span>}
        </Label>
        {input}
        {err ? (
          <p id={`f-${name}-err`} className="text-sm text-destructive">
            {t[err]}
          </p>
        ) : hint ? (
          <p id={`f-${name}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  };
  const a11y = (name: Field, hint?: boolean) => ({
    id: `f-${name}`,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `f-${name}-err` : hint ? `f-${name}-hint` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="grid max-w-md gap-5">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={props.onBack} aria-label={t.back}>
          <ArrowLeft />
        </Button>
        <h2 className="text-base font-medium">{t.yourDetails}</h2>
      </div>
      {field("name", t.name, <Input {...a11y("name")} autoComplete="name" value={values.name} onChange={set("name")} maxLength={100} />)}
      {field(
        "email",
        t.email,
        <Input {...a11y("email", true)} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={set("email")} maxLength={200} />,
        t.emailHint,
      )}
      {field("phone", t.phone, <Input {...a11y("phone")} type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onChange={set("phone")} maxLength={24} />)}
      {field("message", t.message, <Textarea {...a11y("message")} rows={3} value={values.message} onChange={set("message")} maxLength={1000} />, undefined, true)}
      {/* Honeypot: hidden from people and screen readers, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set("website")} />
        </label>
      </div>
      {errors.form && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t[errors.form]}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy} className="h-10 rounded-full px-6">
          {busy ? t.booking : t.book}
        </Button>
      </div>
    </form>
  );
}

function Confirmation(props: {
  result: BookingResult;
  t: Strings;
  lang: Lang;
  personName: string;
  onLang: () => void;
  onAnother: () => void;
}) {
  const { result, t, lang } = props;
  return (
    <div className="grid gap-6 p-6 sm:p-10">
      <div className="flex items-start justify-between gap-3">
        <CheckCircle2 className="size-10 text-[#188038]" aria-hidden />
        <LangSwitch label={t.language} title={t.languageLabel} onClick={props.onLang} />
      </div>
      <div>
        <h1 className="text-2xl font-normal tracking-tight">{t.booked}</h1>
        <p className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{t.meetingWith(props.personName)}</p>
      </div>
      <ul className="grid gap-3 text-sm">
        <li className="flex items-center gap-3">
          <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {capitalize(longDay(result.start, lang))},{" "}
            <span className="font-medium tabular-nums">
              {clock(result.start)}–{clock(result.end)}
            </span>
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Video className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {result.meetUrl ? (
            <a href={result.meetUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {result.meetUrl.replace(/^https:\/\//, "")}
            </a>
          ) : (
            t.meetLater
          )}
        </li>
        <li className="flex items-center gap-3 [overflow-wrap:anywhere]">
          <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {t.invitationSent(result.email)}
        </li>
      </ul>
      <div className="flex flex-wrap gap-3">
        {result.meetUrl && (
          <Button asChild className="rounded-full px-5">
            <a href={result.meetUrl} target="_blank" rel="noreferrer">
              <Video />
              {t.joinMeet}
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-full px-5">
          <a href={`/b/${result.token}?lang=${lang}`}>{t.manage}</a>
        </Button>
        <Button variant="ghost" className="rounded-full px-5 text-primary hover:text-primary" onClick={props.onAnother}>
          {t.bookAnother}
        </Button>
      </div>
    </div>
  );
}

function Message({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="grid max-w-md content-start gap-3 py-4">
      <h2 className="text-base font-medium">{title}</h2>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div aria-busy role="status" className={cn("grid gap-6 lg:grid-cols-[auto_minmax(12rem,1fr)]")}>
      <span className="sr-only">{label}</span>
      <div className="grid gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-[19rem] w-[19rem] rounded-lg" />
      </div>
      <div className="grid content-start gap-2">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
