import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const hex = {
  d8ff3e:"ff5236", e4ff75:"ff7a5c", e8ff86:"ff7a5c", e9ff8c:"ff7a5c", ecff9e:"ff8a6e", f0ffab:"ffb3a1", f4ffbc:"ffc4b5", c9f134:"e8401f", "6b7d1f":"8a2a1a",
  "07080b":"150a12", "05060a":"0d060c", "08090d":"120810", "0e1117":"1e1019", "141821":"291623", "232936":"40283a", "12161e":"1a0d16",
  "1a1f2b":"33202c", "333b4c":"6b4459", f6f7f2:"f7ede3", "8a93a6":"b9a3ae", ff3d8a:"f2417c", "8b9bff":"93a7ff", ffc857:"f2b24c",
  "2b3344":"4a2c3e", "262d3c":"3a2232", "3a4356":"5c3a4e",
};
const rgb = {
  "216,255,62":"255,82,54", "13,17,10":"26,10,8", "8,10,7":"18,8,6", "7,8,11":"21,10,18", "14,17,23":"30,16,25", "20,24,33":"41,22,35",
  "35,41,54":"64,40,58", "26,31,42":"51,32,44", "51,59,76":"107,68,89", "28,33,44":"56,34,48", "23,28,38":"46,26,40", "22,27,37":"44,24,38",
  "16,20,28":"34,18,30", "15,17,24":"32,17,27", "12,15,21":"26,13,22", "10,12,16":"22,10,18", "9,11,16":"20,9,17", "9,10,13":"19,9,16",
  "9,9,11":"19,9,15", "246,247,242":"247,237,227", "138,147,166":"185,163,174", "255,61,138":"242,65,124", "139,155,255":"147,167,255", "255,200,87":"242,178,76",
};
const files = execSync("rg -l -i 'd8ff3e|07080b|rgba?\\(|#[0-9a-f]{6}|0x[0-9a-f]{6}|FanRank|FANRANK' src tests scripts --glob '!*.sql'", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
let changed = 0;
for (const f of files) {
  const before = readFileSync(f, "utf8");
  let s = before.replace(/(#|0x)([0-9a-fA-F]{6})\b/g, (m, p, h) => { const n = hex[h.toLowerCase()]; return n ? p + (h === h.toUpperCase() && /[A-F]/.test(h) ? n.toUpperCase() : n) : m; });
  s = s.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, a, b, c) => { const n = rgb[`${a},${b},${c}`]; return n ? m.replace(/\d+\s*,\s*\d+\s*,\s*\d+/, n.split(",").join(", ").replace(/, /g, m.includes(", ") ? ", " : ",")) : m; });
  s = s.replace(/FanRank/g, "Ultfave").replace(/FANRANK/g, "ULTFAVE");
  if (s !== before) { writeFileSync(f, s); changed++; console.log("updated", f); }
}
console.log("files changed:", changed);
