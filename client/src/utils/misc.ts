export const isProd = ()=>{
    return import.meta.env.PROD
}
export const inRange = (n:number)=>{
    return new Array(Math.floor(n)).fill(1).map((_v,i)=>i)
}
