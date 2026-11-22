// Explicit-send browser adapter for Harmony's JSON feedback contract; owns only its outbox.
export const TOWN_FEEDBACK_KEY = 'common-table.town.feedback.v1';
export const TOWN_FEEDBACK_ENDPOINT = 'https://harmony-feedback.fly.dev/api/entries';
const LIMIT = 20;
const KINDS = new Set(['bug', 'idea', 'praise', 'other']);
const textField = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

function validateEntry(entry) {
  return entry && entry.app === 'common-table-town' && entry.platform === 'web'
    && textField(entry.ref, 100) && textField(entry.text, 4000) && entry.text.trim()
    && KINDS.has(entry.kind) && textField(entry.appVersion, 64)
    && textField(entry.ts, 40) && Number.isFinite(Date.parse(entry.ts))
    && entry.context && textField(entry.context.screen, 50);
}

export function createTownFeedback({
  storage,
  fetch: request = globalThis.fetch,
  endpoint = TOWN_FEEDBACK_ENDPOINT,
  version = 'prototype',
  timeoutMs = 8000,
  now = () => new Date().toISOString(),
  // getRandomValues also works on HTTP phone previews, unlike randomUUID.
  makeRef = () => `town-feedback-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('')}`,
} = {}) {
  let sending = false;
  const acknowledged = new Set();

  function read() {
    const raw = storage.getItem(TOWN_FEEDBACK_KEY);
    if (raw === null) return { raw, entries: [] };
    try {
      const data = JSON.parse(raw);
      if (data.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > LIMIT
        || !data.entries.every(validateEntry)
        || new Set(data.entries.map(entry => entry.ref)).size !== data.entries.length) throw Error();
      return { raw, entries: data.entries };
    } catch {
      throw Error('The saved feedback outbox cannot be read. It has been preserved. Copy your note before closing.');
    }
  }

  function write(snapshot, entries) {
    if (storage.getItem(TOWN_FEEDBACK_KEY) !== snapshot.raw) {
      throw Error('Feedback changed in another tab. Your note has not been replaced. Try again.');
    }
    storage.setItem(TOWN_FEEDBACK_KEY, JSON.stringify({ schema: 1, entries }));
  }

  function pending() {
    return read().entries.length;
  }

  async function send(entry) {
    if (acknowledged.has(entry.ref)) return removeAccepted(entry);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let accepted = false;
    try {
      // Rebuild the published payload so arbitrary local-storage fields never leave the browser.
      const { ref, text, kind, appVersion, ts } = entry;
      const response = await request(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
        body: JSON.stringify({ app: 'common-table-town', message: text, kind,
          context: { ref, appVersion, platform: 'web', at: ts, screen: entry.context.screen } }),
      });
      const receipt = await response.json();
      accepted = response.status === 201 && textField(receipt?.data?.id, 100)
        && receipt.data.app === 'common-table-town' && receipt.data.message === text
        && receipt.data.context?.ref === ref;
    } catch {
      // Network loss, timeout and unreadable acknowledgments all retain the same reference.
    } finally {
      clearTimeout(timer);
    }
    if (!accepted) return { ref: entry.ref, delivered: false };
    acknowledged.add(entry.ref);
    return removeAccepted(entry);
  }

  function removeAccepted(entry) {
    try {
      const latest = read();
      write(latest, latest.entries.filter(candidate => candidate.ref !== entry.ref));
      return { ref: entry.ref, delivered: true };
    } catch {
      // Keep the known receipt in memory; a reload cannot recover it if storage stays blocked.
      return { ref: entry.ref, delivered: true, cleanupPending: true };
    }
  }

  async function submit({ text, kind = 'other', screen = 'menu' } = {}) {
    if (sending) throw Error('A note is being sent. Keep this note here and try again in a moment.');
    const entry = { app: 'common-table-town', platform: 'web', ref: makeRef(),
      text: typeof text === 'string' ? text.trim() : '', kind, appVersion: version,
      ts: now(), context: { screen } };
    if (!validateEntry(entry)) throw Error('Write a note of 1–4000 characters and choose a feedback type.');
    const snapshot = read();
    if (snapshot.entries.length >= LIMIT) throw Error('Your feedback outbox is full. Retry saved notes before adding another.');
    if (snapshot.entries.some(candidate => candidate.ref === entry.ref)) throw Error('This feedback reference already exists. Try again.');
    // Storage failures stop before any network request, leaving the caller's draft intact.
    write(snapshot, [...snapshot.entries, entry]);
    sending = true;
    try { return await send(entry); } finally { sending = false; }
  }

  async function retry() {
    if (sending) throw Error('Feedback is already being sent.');
    const entries = read().entries;
    sending = true;
    const results = [];
    try {
      for (const entry of entries) {
        const result = await send(entry);
        results.push(result);
        if (!result.delivered || result.cleanupPending) break;
      }
      return { results, remaining: pending() };
    } finally { sending = false; }
  }

  // No startup, online-event or timer hook sends notes: both methods require a user action.
  return { pending, submit, retry };
}
