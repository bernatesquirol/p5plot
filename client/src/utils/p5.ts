import p5 from "p5";

export function p5ColorToHex(p: p5, c: p5.Color): string {
  const r = Math.round(p.red(c));
  const g = Math.round(p.green(c));
  const b = Math.round(p.blue(c));

  // Convert each component to 2-digit hex
  const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
  return hex;
}
export const InvisibleColor = "rgba(255,255,255,0)"
export const addCallback = (p5:p5, attribute, callback)=>{
  if (p5[attribute]!=null){
      let previousAttribute = p5[attribute]
      p5[attribute] = (e)=>{
        previousAttribute(e)
        callback(e)
      }
  }else{
    p5[attribute] = callback
  }
}

// if (this.p5.touchEnded!=null){
//     this.p5.touchEnded = (_e)=>{
//     prevTouchEnded(_e);
//     newTouchEnded(_e)
//   }
// }else this.p5.touchEnded = newTouchEnded