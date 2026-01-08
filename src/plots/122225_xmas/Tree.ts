import { Polygon } from "@flatten-js/core";
import { bindHollowBody, equilateralTriangleCentroidDown } from "../../utils";
import p5 from "p5";

export class Tree {
    shape: Polygon
    walls: Matter.Body[]
    p5: p5
    engine: Matter.Engine
    constructor({x,y,w,h},{p5, engine}: {p5: p5, engine: Matter.Engine}){
        this.shape = equilateralTriangleCentroidDown({ x,y,w,h })
        this.walls = bindHollowBody(engine.world, this.shape)
        this.p5 = p5
        this.engine = engine
    }
    onClick(){
        this.shape
    }
    onDrag(){

    }
}