// Minimal Chrome DevTools Protocol sürücüsü (bağımlılıksız, Node 22+ WebSocket)
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, width = 390, height = 844, scale = 2, mobile = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "chrome-"));
  const proc = spawn("google-chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
  ], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`EXCEPTION: ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
    } else if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      logs.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      logs.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ""}`);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });

  const api = {
    logs,
    send,
    async goto(url, wait = 600) { await send("Page.navigate", { url }); await sleep(wait); },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async shot(path, { full = false } = {}) {
      let clip;
      if (full) {
        const h = await api.eval("document.documentElement.scrollHeight");
        await send("Emulation.setDeviceMetricsOverride", { width, height: Math.min(h, 6000), deviceScaleFactor: scale, mobile });
        await sleep(200);
      }
      const { data } = await send("Page.captureScreenshot", { format: "png", clip });
      writeFileSync(path, Buffer.from(data, "base64"));
      if (full) await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
    },
    async setViewport(w, h, m = mobile) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile: m }); },
    async close() { try { await send("Browser.close"); } catch {} ws.close(); proc.kill(); },
    sleep,
  };
  return api;
}
