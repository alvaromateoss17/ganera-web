// Sends a notification email through Resend when RESEND_API_KEY is configured in Vercel.
// Without it, the payload is only written to the function logs (Vercel → Logs).
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function notify(subject, fields) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_TO_EMAIL;
  console.log(subject, JSON.stringify(fields));
  if (!key || !to) return;
  const rows = Object.entries(fields).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#605d5d">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.LEADS_FROM_EMAIL || 'Ganera <onboarding@resend.dev>',
      to: to.split(',').map((s) => s.trim()),
      reply_to: fields.email || undefined,
      subject,
      html: `<table style="font-family:Arial,sans-serif;font-size:14px">${rows}</table>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = { notify, isEmail, clean, readBody };
