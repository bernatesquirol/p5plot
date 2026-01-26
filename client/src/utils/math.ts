export const randomBetween = (init:number, end:number)=>{
    return Math.random()*(end-init)+init
}
export const getRandomFromList = (list)=>{
  let index = Math.floor(Math.random() * list.length);
  return list[index]
}
export const gaussianField = (k: {x: number, y: number}, radius: number) => {
  // We want exp(-r^2 / (2*sigma^2)) = 0 (practically)
  // Let's set the field to a small value (e.g., 0.01) at the radius
  // 0.01 = exp(-radius^2 / (2*sigma^2))
  // ln(0.01) = -radius^2 / (2*sigma^2)
  // sigma = radius / sqrt(-2*ln(0.01))
  
  const threshold = 0.01; // Field value at the specified radius
  const sigma = radius / Math.sqrt(-2 * Math.log(threshold));
  
  return (x: number, y: number): number => {
    const dx = x - k.x;
    const dy = y - k.y;
    const distSq = dx * dx + dy * dy;
    return Math.exp(-distSq / (2 * sigma * sigma));
  };
};
