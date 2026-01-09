import p5 from "p5";

export function p5ColorToHex(p: p5, c: p5.Color): string {
  const r = Math.round(p.red(c));
  const g = Math.round(p.green(c));
  const b = Math.round(p.blue(c));

  // Convert each component to 2-digit hex
  const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
  return hex;
}