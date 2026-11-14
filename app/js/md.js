// İçerikte kullandığımız Markdown alt kümesi için küçük bir dönüştürücü:
// başlık, paragraf, tablo, liste, alıntı, **kalın**, *italik*, ~~üstü çizili~~, `kod`, \* kaçışları.

import { esc } from "./util.js";
import { ttsSupported, speakerIcon } from "./speech.js";

/** Markdown işaretlerinden arındırılmış düz metin (seslendirme için) */
const plain = (s) => s.replace(/\\([*|_~`\\])/g, "$1").replace(/\*\*|~~|`/g, "").replace(/(^|\W)\*(\S)/g, "$1$2").replace(/(\S)\*(\W|$)/g, "$1$2");

export function inline(src) {
  let s = esc(src);
  s = s.replace(/\\([*|_~`\\])/g, (_, c) => `&#${c.charCodeAt(0)};`);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  return s;
}

const splitRow = (line) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());

function table(lines) {
  const [head, , ...rows] = lines.map(splitRow);
  const hasHead = head.some((c) => c);
  const th = hasHead ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : "";
  const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table>${th}<tbody>${tb}</tbody></table></div>`;
}

export function markdown(src) {
  const lines = String(src ?? "").replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const take = (re) => {
    const block = [];
    while (i < lines.length && re.test(lines[i])) block.push(lines[i++]);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)/))) {
      const lvl = Math.min(m[1].length + 2, 6);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++;
    } else if (/^\s*\|/.test(line)) {
      out.push(table(take(/^\s*\|/)));
    } else if (/^>\s?/.test(line)) {
      const block = take(/^>\s?/).map((l) => l.replace(/^>\s?/, ""));
      // Boş "> " satırları paragraf ayırır
      const paras = block.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
      // Seslendirmede başlık gibi noktasız paragraflardan sonra duraklama olsun
      const spoken = paras.map((p) => plain(p)).map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ");
      const say = ttsSupported
        ? `<button class="btn small say-block" data-say="${esc(spoken)}">${speakerIcon} Metni dinle</button>`
        : "";
      const body = paras.length > 1 ? paras.map((p) => `<p>${inline(p)}</p>`).join("") : inline(paras[0] ?? "");
      out.push(`<blockquote>${body}${say}</blockquote>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items = take(/^\s*[-*]\s+/).map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items = take(/^\s*\d+\.\s+/).map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      out.push(`<ol>${items.join("")}</ol>`);
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(\s*\||>|\s*[-*]\s|\s*\d+\.\s|#)/.test(lines[i])) {
        para.push(lines[i++]);
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}
