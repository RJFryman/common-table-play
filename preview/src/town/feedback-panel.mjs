// Collapsed, explicit-send feedback UI; draft survives town navigation and failures.
import { createTownFeedback } from "./feedback.mjs";
export function townFeedbackPanel({ storage, esc }) {
  let draft = "",
    kind = "idea",
    status = "",
    busy = false,
    open = false,
    currentPanel = null;
  const client = createTownFeedback({
    storage,
    version: "town-standing-requests-v1",
  });
  function markup() {
    let count = 0,
      problem = "";
    try {
      count = client.pending();
    } catch (error) {
      problem = error.message;
    }
    return /* HTML */ `<details
      class="town-menu-card town-feedback-panel"
      ${open ? "open" : ""}
    >
      <summary>Send an idea or report a problem</summary>
      <p>
        Your note goes to the game makers with the game version and screen. Your
        town save is not sent.
      </p>
      <label
        >Kind<select id="town-note-kind" ${busy ? "disabled" : ""}>
          <option value="idea" ${kind === "idea" ? "selected" : ""}>
            Idea
          </option>
          <option value="bug" ${kind === "bug" ? "selected" : ""}>
            Problem
          </option>
          <option value="praise" ${kind === "praise" ? "selected" : ""}>
            Something you liked
          </option>
        </select></label
      >
      <label
        >Your note<textarea
          id="town-note"
          ${busy ? "disabled" : ""}
          maxlength="4000"
          rows="4"
        >
${esc(draft)}</textarea>
      </label>
      <button id="town-note-send" ${busy ? "disabled" : ""}>
        ${busy ? "Sending…" : "Send note"}
      </button>
      <button id="town-note-retry" ${busy || !count ? "disabled" : ""}>
        Retry saved notes (${count})
      </button>
      <p class="small">
        If offline, Send saves your note here. Use Retry when connected. Nothing
        sends automatically. If a receipt was lost, retrying may send a
        duplicate.
      </p>
      <p id="town-note-status" role="status">${esc(status || problem)}</p>
    </details>`;
  }
  function bind(root) {
    const panel = root.querySelector(".town-feedback-panel");
    currentPanel = panel;
    if (!panel) return;
    const text = panel.querySelector("#town-note"),
      picker = panel.querySelector("#town-note-kind");
    panel.ontoggle = () => (open = panel.open);
    text.oninput = () => (draft = text.value);
    picker.onchange = () => (kind = picker.value);
    const send = panel.querySelector("#town-note-send"),
      retry = panel.querySelector("#town-note-retry");
    async function act(isRetry) {
      if (busy) return;
      busy = true;
      send.disabled = true;
      retry.disabled = true;
      text.disabled = true;
      picker.disabled = true;
      try {
        if (isRetry) {
          const result = await client.retry();
          status = result.remaining
            ? `${result.remaining} saved note(s) still waiting. Retry when connected.`
            : "All saved notes received. Thank you.";
        } else {
          const result = await client.submit({
            text: draft,
            kind,
            screen: "menu",
          });
          draft = "";
          text.value = "";
          status = result.delivered
            ? result.cleanupPending
              ? "Received. A local copy remains; retrying may send a duplicate."
              : "Note received. Thank you."
            : "Saved on this device. Retry when connected.";
        }
      } catch (error) {
        status = error.message;
      } finally {
        busy = false;
        const visible = currentPanel;
        if (!visible?.isConnected) return;
        visible.querySelector("#town-note-send").disabled = false;
        visible.querySelector("#town-note-send").textContent = "Send note";
        visible.querySelector("#town-note").disabled = false;
        visible.querySelector("#town-note").value = draft;
        visible.querySelector("#town-note-kind").disabled = false;
        let count = 0;
        try {
          count = client.pending();
        } catch {}
        visible.querySelector("#town-note-retry").disabled = !count;
        visible.querySelector("#town-note-retry").textContent =
          `Retry saved notes (${count})`;
        visible.querySelector("#town-note-status").textContent = status;
      }
    }
    send.onclick = () => act(false);
    retry.onclick = () => act(true);
  }
  return { markup, bind };
}
