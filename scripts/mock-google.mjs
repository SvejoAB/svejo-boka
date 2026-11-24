// Local stand-in for Google OAuth and Calendar (and Resend's /emails), for development and browser
// checks without a real Google account. Never deployed.
//   MOCK_FIXTURES=path/to/fixtures.json node scripts/mock-google.mjs
// fixtures.json: { "<calendarId>": [ <Calendar API event>, ... ], ... }
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.MOCK_PORT ?? 8788);
const EMAIL = process.env.MOCK_EMAIL ?? "alex@example.com";
const calendars = process.env.MOCK_FIXTURES ? JSON.parse(readFileSync(process.env.MOCK_FIXTURES, "utf8")) : {};
let seq = 0;
const sent = [];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw;
}

function overlaps(ev, min, max) {
  const s = Date.parse(ev.start.dateTime ?? ev.start.date);
  const e = Date.parse(ev.end.dateTime ?? ev.end.date);
  return s < max && e > min;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/o/oauth2/v2/auth") {
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", "mock-code");
    back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }

  if (path === "/token" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    const base = { access_token: `mock-access-${++seq}`, expires_in: 3600, token_type: "Bearer" };
    if (form.get("grant_type") === "authorization_code") {
      const idToken = `${b64({ alg: "none" })}.${b64({ email: EMAIL, email_verified: true, aud: form.get("client_id") })}.x`;
      return send(res, 200, {
        ...base,
        refresh_token: "mock-refresh",
        id_token: idToken,
        scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events",
      });
    }
    return send(res, 200, base);
  }

  // Stand-in for Resend: records emails instead of sending them.
  if (path === "/emails" && req.method === "POST") {
    const mail = JSON.parse(await readBody(req));
    mail.idempotencyKey = req.headers["idempotency-key"];
    sent.push(mail);
    console.log("email", mail.idempotencyKey, "->", mail.to.join(","), "|", mail.subject);
    return send(res, 200, { id: `mail${++seq}` });
  }
  if (path === "/emails" && req.method === "GET") return send(res, 200, sent);

  const m = path.match(/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const list = (calendars[id] ??= []);
    if (req.method === "GET" && !m[2]) {
      const min = Date.parse(url.searchParams.get("timeMin"));
      const max = Date.parse(url.searchParams.get("timeMax"));
      return send(res, 200, { items: list.filter((e) => e.status !== "cancelled" && overlaps(e, min, max)) });
    }
    if (req.method === "POST" && !m[2]) {
      const body = JSON.parse(await readBody(req));
      const code = Math.random().toString(36).slice(2, 12);
      const meet = `https://meet.google.com/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7, 10)}`;
      const ev = {
        ...body,
        id: `mock${++seq}`,
        status: "confirmed",
        // MOCK_MEET_PENDING=1: like Google when the Meet room is still being made.
        ...(process.env.MOCK_MEET_PENDING ? { _meet: meet, _reads: 0 } : { hangoutLink: meet }),
        attendees: [...(body.attendees ?? []), { email: EMAIL, self: true, responseStatus: "accepted" }],
      };
      list.push(ev);
      console.log("created", ev.summary, ev.start.dateTime, "sendUpdates=" + url.searchParams.get("sendUpdates"));
      return send(res, 200, ev);
    }
    if (req.method === "GET" && m[2]) {
      const ev = list.find((e) => e.id === m[2]);
      if (!ev) return send(res, 404, { error: { message: "Not Found" } });
      // The link appears on the second read.
      if (ev._meet && ++ev._reads >= 2) ev.hangoutLink = ev._meet;
      return send(res, 200, { hangoutLink: ev.hangoutLink });
    }
    if (req.method === "DELETE" && m[2]) {
      const i = list.findIndex((e) => e.id === m[2]);
      if (i < 0) return send(res, 404, { error: { message: "Not Found" } });
      list.splice(i, 1);
      console.log("deleted", m[2]);
      res.writeHead(204);
      return res.end();
    }
  }
  send(res, 404, { error: { message: `mock: no route ${req.method} ${path}` } });
}).listen(PORT, () => console.log(`mock google on http://localhost:${PORT}`));
