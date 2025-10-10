import p5 from 'p5';
import p5plot from 'p5.plotsvg';
import GUI from 'lil-gui'; 
const gui = new GUI();
import './style.css';
const settings = {
} as any


// Add sliders to number fields by passing min and max
// gui.add( myObject, 'myNumber', 0, 1 );
// gui.add( myObject, 'myNumber', 0, 100, 2 ); // snap to even numbers

// Create dropdowns by passing an array or object of named values
// gui.add( myObject, 'myNumber', [ 0, 1, 2 ] );
// gui.add( myObject, 'myNumber', { Label1: 0, Label2: 1, Label3: 2 } );

const param = ()=>{
  gui.add
}

class Layer {
  visible: boolean
  name: string
  constructor(name:string){
    this.name=name
    this.visible = true
    p5plot.beginSvgGroup(name)
    settings[`layer_${name}`] = true
    gui.add(settings, `layer_${name}`).onChange((v:boolean)=>this.visible=v)
  }
  closeLayer(){
    p5plot.endSvgGroup(this.name)
  }
}
// TODO:
// 1. crear capes visible / no visible
// 2. afegir background: field + pintures (no imprimir)
// 3. transitions (velocity & z-index)
// 4. fer un json que controli la velocitat, repeticions, z-index
// 5. server executi el svg + json
// 6. despres fer que json + svg es pugin a "server" desde la web
// 7. executing pipeline feedback
const layers: any = {}
const addLayer = (name:string)=>{
  if (!layers[name]){
    layers[name]=new Layer(name)
  }
  return layers[name]
}
const _app = new p5((p5Instance: p5) => {
  const p = p5Instance as unknown as p5;
  let bDoExportSvg = false
  const x = 100;
  const y = 100;
  function drawDesign (){
    
    // Tests of squares and rects with various rectModes
    
    let a = addLayer("someSquares")
    if (a.visible){
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CENTER)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CORNERS)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.RADIUS)
      p5Instance.square(100, 250, 50)
      p5Instance.rectMode(p5Instance.CENTER)
      p5Instance.rect(75, 350, 100, 50)
      p5Instance.rectMode(p5Instance.CORNER)
      p5Instance.rect(75, 350, 100, 50)
      // console.log("visible")
    }
    a.closeLayer();

    // Tests of circles and ellipses with various ellipseModes
    const b = addLayer("someCircles")
    if (b.visible){
      
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.RADIUS)
      p5Instance.circle(200, 250, 50)
      p5Instance.ellipseMode(p5Instance.CORNERS)
      p5Instance.circle(50, 100, 200)
      p5Instance.ellipseMode(p5Instance.CORNER)
      p5Instance.ellipse(175, 350, 100, 50)
      p5Instance.ellipseMode(p5Instance.CENTER)
      p5Instance.ellipse(175, 350, 100, 50)
    }
    b.closeLayer();

    // Tests of rounded vs. non-rounded squares and rects
    p5plot.beginSvgGroup("someRectsAndRoundedRects")
    p5Instance.rect(300, 25, 75, 50, 15)
    p5Instance.rect(375, 25, 75, 50)
    p5Instance.stroke('blue')
    p5Instance.square(300, 100, 75, 15)
    p5Instance.square(375, 100, 75)
    p5Instance.stroke('red')
    p5Instance.rect(475, 25, 80, 100, 0, 10, 20, 40)
    p5Instance.square(490, 40, 50, 5, 10, 0, 25)
    p5Instance.stroke("black")
    p5plot.endSvgGroup();
    var OPEN = p5Instance.OPEN
    console.log(OPEN)
    // Tests of arcs with various sweeps and closure modes
    p5plot.beginSvgGroup("someCircularArcs")
    p5Instance.ellipseMode(p5Instance.CENTER)
    p5Instance.arc(400, 250, 110, 110, 1, p5Instance.PI)
    p5Instance.arc(400, 250, 100, 100, p5Instance.PI, 1, p5Instance.OPEN)
    p5Instance.arc(400, 250, 90, 90, p5Instance.PI, 1, p5Instance.CHORD)
    p5Instance.arc(400, 250, 80, 80, p5Instance.PI, 1, p5Instance.PIE)
    p5Instance.arc(400, 250, 100, 100, 1.1, p5Instance.PI - 0.1, p5Instance.CHORD)
    p5Instance.arc(410, 250, 50, 50, 0, 1, p5Instance.PIE)
    p5plot.endSvgGroup();

    p5plot.beginSvgGroup("someEllipticalArcs")
    p5Instance.ellipseMode(p5Instance.CENTER)
    p5Instance.arc(520, 250, 110, 70, 1, p5Instance.PI)
    p5Instance.arc(520, 250, 100, 60, p5Instance.PI, 1, p5Instance.OPEN)
    p5Instance.arc(520, 250, 90, 50, p5Instance.PI, 1, p5Instance.CHORD)
    p5Instance.arc(520, 250, 80, 40, p5Instance.PI, 1, p5Instance.PIE)
    p5Instance.arc(520, 250, 100, 60, 1.1, p5Instance.PI - 0.1, p5Instance.CHORD)
    p5Instance.arc(530, 250, 50, 20, 0, 1, p5Instance.PIE)
    p5plot.endSvgGroup();

    p5plot.beginSvgGroup("someSimpleCurves")
    p5Instance.bezier(95, 20, 20, 10, 100, 90, 25, 80)
    p5Instance.curveTightness(-10)
    p5Instance.curve(5, 26, 73, 24, 73, 61, 15, 65)
    p5Instance.curveTightness(0)
    p5plot.endSvgGroup();

    p5plot.beginSvgGroup("someTransforms")
    p5Instance.rectMode(p5Instance.CENTER)
    p5Instance.push()
    p5Instance.translate(560, 575)
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(534, 591)
    p5Instance.rotate(p5Instance.radians(20))
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(553, 622)
    p5Instance.shearX(p5Instance.radians(-20))
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(553, 622)
    p5Instance.shearX(p5Instance.radians(-20))
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(539, 643)
    p5Instance.shearY(p5Instance.radians(20))
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(542, 668)
    p5Instance.scale(0.6666, 1.0)
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.pop()
    p5Instance.push()
    p5Instance.translate(542, 692)
    p5Instance.rotate(p5Instance.radians(20.0))
    p5Instance.shearX(p5Instance.radians(-20.0))
    p5Instance.rect(0, 0, 60, 40)
    p5Instance.line(-30, -20, 30, 20)
    p5Instance.pop()
    p5Instance.rectMode(p5Instance.CORNER)
    p5plot.endSvgGroup();

    p5plot.beginSvgGroup("someOtherShapes")
    p5Instance.point(300, 255)
    p5Instance.circle(300, 255, 10)
    p5Instance.line(260, 290, 285, 210)
    p5Instance.triangle(300, 225, 325, 275, 275, 275)
    p5Instance.quad(275, 200, 325, 200, 350, 300, 250, 300)
    p5plot.endSvgGroup();

    // Tests of open and closed polylines with simple vertices
    p5plot.beginSvgGroup("simplePolylinesAndPolygons")
    p5Instance.beginShape()
    p5Instance.vertex(70, 530)
    p5Instance.vertex(130, 530)
    p5Instance.vertex(130, 550)
    p5Instance.vertex(90, 550)
    p5Instance.vertex(90, 570)
    p5Instance.vertex(130, 570)
    p5Instance.vertex(130, 590)
    p5Instance.vertex(70, 590)
    p5Instance.endShape();

    p5Instance.beginShape()
    p5Instance.vertex(70, 610)
    p5Instance.vertex(130, 610)
    p5Instance.vertex(130, 630)
    p5Instance.vertex(90, 630)
    p5Instance.vertex(90, 650)
    p5Instance.vertex(130, 650)
    p5Instance.vertex(130, 670)
    p5Instance.vertex(70, 670)
    p5Instance.endShape(p5Instance.CLOSE)
    p5plot.endSvgGroup();


    p5plot.beginSvgGroup("complexPolylinesAndPolygons")
    p5Instance.beginShape()
    p5Instance.vertex(300, 340)
    p5Instance.quadraticVertex(360, 340, 330, 370)
    p5Instance.quadraticVertex(300, 400, 360, 400)
    p5Instance.vertex(360, 330)
    p5Instance.vertex(300, 330)
    p5Instance.endShape();

    p5Instance.beginShape()
    p5Instance.vertex(300, 420)
    p5Instance.quadraticVertex(360, 420, 330, 450)
    p5Instance.quadraticVertex(300, 480, 360, 480)
    p5Instance.vertex(360, 410)
    p5Instance.vertex(300, 410)
    p5Instance.endShape(p5Instance.CLOSE);

    p5Instance.beginShape()
    p5Instance.vertex(430, 320)
    p5Instance.bezierVertex(480, 300, 480, 375, 430, 375)
    p5Instance.bezierVertex(450, 380, 460, 325, 430, 320)
    p5Instance.endShape();

    p5Instance.beginShape()
    p5Instance.vertex(400, 420)
    p5Instance.bezierVertex(400, 420, 410, 400, 420, 420)
    p5Instance.bezierVertex(420, 420, 430, 440, 440, 420)
    p5Instance.bezierVertex(440, 420, 450, 400, 460, 420)
    p5Instance.vertex(460, 460)
    p5Instance.vertex(400, 460)
    p5Instance.vertex(400, 420)
    p5Instance.endShape();

    p5Instance.beginShape()
    p5Instance.vertex(530, 470)
    p5Instance.bezierVertex(525, 425, 600, 450, 550, 500)
    p5Instance.bezierVertex(550, 540, 575, 540, 600, 520)
    p5Instance.endShape();

    p5Instance.beginShape()
    p5Instance.vertex(530, 370)
    p5Instance.bezierVertex(525, 325, 600, 350, 550, 400)
    p5Instance.bezierVertex(520, 430, 575, 440, 600, 420)
    p5Instance.endShape();

    // See: https://github.com/processing/p5.js/issues/6560
    p5Instance.beginShape()
    p5Instance.vertex(275, 500)
    p5Instance.vertex(280, 500)
    p5Instance.bezierVertex(300, 500, 310, 530, 325, 530)
    p5Instance.bezierVertex(340, 530, 350, 500, 370, 500)
    p5Instance.vertex(375, 500)
    p5Instance.vertex(375, 540)
    p5Instance.vertex(275, 540)
    p5Instance.endShape(p5Instance.CLOSE);

    p5Instance.beginShape()
    p5Instance.vertex(275, 550)
    p5Instance.vertex(375, 550)
    p5Instance.vertex(375, 590)
    p5Instance.vertex(350, 595)
    p5Instance.quadraticVertex(325, 540, 300, 595)
    p5Instance.vertex(300, 595)
    p5Instance.vertex(275, 590)
    p5Instance.endShape(p5Instance.CLOSE);

    p5Instance.beginShape()
    for (let i = 0; i < 24; i++) {
      let t = p5Instance.map(i, 0, 24, 0, p5Instance.TWO_PI)
      let r = (i % 2 == 0) ? 45 : 25
      let px = 200 + r * p5Instance.cos(t)
      let py = 560 + r * p5Instance.sin(t)
      p5Instance.vertex(px, py)
    }
    p5Instance.endShape(p5Instance.CLOSE);

    p5Instance.beginShape()
    for (let i = 0; i < 27; i++) {
      let t = p5Instance.map(i, 0, 24, 0, p5Instance.TWO_PI)
      let r = (i % 2 == 0) ? 45 : 35
      let px = 200 + r * p5Instance.cos(t)
      let py = 660 + r * p5Instance.sin(t)
      p5Instance.curveVertex(px, py)
    }
    p5Instance.endShape();

    let cpts = [[340, 500], [340, 500], [380, 520], [400, 560], [360, 580], [350, 610], [350, 610]]
    for (let j = 0; j < 7; j++) {
      p5Instance.beginShape()
      for (let i = 0; i < j; i++) {
        p5Instance.curveVertex(cpts[i][0] + 15 * j, cpts[i][1])
      }
      p5Instance.endShape()
    }
    p5plot.endSvgGroup();


    p5plot.beginSvgGroup("multiPointShapeVariants")
    p5Instance.beginShape(p5Instance.TRIANGLE_STRIP)
    p5Instance.vertex(250 + 30, 600 + 75)
    p5Instance.vertex(250 + 40, 600 + 20)
    p5Instance.vertex(250 + 50, 600 + 75)
    p5Instance.vertex(250 + 60, 600 + 20)
    p5Instance.vertex(250 + 70, 600 + 75)
    p5Instance.vertex(250 + 80, 600 + 20)
    p5Instance.vertex(250 + 90, 600 + 75)
    p5Instance.endShape();

    p5Instance.beginShape(p5Instance.TRIANGLES)
    p5Instance.vertex(250 + 30, 660 + 75)
    p5Instance.vertex(250 + 40, 660 + 20)
    p5Instance.vertex(250 + 50, 660 + 75)
    p5Instance.vertex(250 + 60, 660 + 20)
    p5Instance.vertex(250 + 70, 660 + 75)
    p5Instance.vertex(250 + 80, 660 + 20)
    p5Instance.endShape();

    p5Instance.beginShape(p5Instance.QUAD_STRIP)
    p5Instance.vertex(330 + 30, 600 + 20)
    p5Instance.vertex(330 + 30, 600 + 75)
    p5Instance.vertex(330 + 50, 600 + 20)
    p5Instance.vertex(330 + 50, 600 + 75)
    p5Instance.vertex(330 + 65, 600 + 20)
    p5Instance.vertex(330 + 65, 600 + 75)
    p5Instance.vertex(330 + 85, 600 + 20)
    p5Instance.vertex(330 + 85, 600 + 75)
    p5Instance.endShape();

    p5Instance.beginShape(p5Instance.QUADS)
    p5Instance.vertex(330 + 30, 660 + 20)
    p5Instance.vertex(330 + 30, 660 + 75)
    p5Instance.vertex(330 + 50, 660 + 75)
    p5Instance.vertex(330 + 50, 660 + 20)
    p5Instance.vertex(330 + 65, 660 + 20)
    p5Instance.vertex(330 + 65, 660 + 75)
    p5Instance.vertex(330 + 85, 660 + 75)
    p5Instance.vertex(330 + 85, 660 + 20)
    p5Instance.endShape();

    p5Instance.beginShape(p5Instance.TRIANGLE_FAN)
    p5Instance.vertex(410 + 57, 600 + 50)
    p5Instance.vertex(410 + 57, 600 + 15)
    p5Instance.vertex(410 + 92, 600 + 50)
    p5Instance.vertex(410 + 57, 600 + 85)
    p5Instance.vertex(410 + 22, 600 + 50)
    p5Instance.vertex(410 + 57, 600 + 15)
    p5Instance.endShape();

    p5Instance.beginShape(p5Instance.POINTS)
    for (let i = 0; i < 60; i++) {
      let t = p5Instance.map(i, 0, 60, 0, p5Instance.TWO_PI)
      let px = 467 + 30 * p5Instance.cos(t)
      let py = 720 + 30 * p5Instance.sin(t)
      p5Instance.vertex(px, py)
    }
    p5Instance.endShape(p5Instance.CLOSE);

    p5Instance.beginShape(p5Instance.LINES)
    for (let i = 0; i < 40; i++) {
      let t = p5Instance.map(i, 0, 40, 0, p5Instance.TWO_PI)
      let px = 467 + 25 * p5Instance.cos(t)
      let py = 720 + 25 * p5Instance.sin(t)
      p5Instance.vertex(px, py)
    }
    p5Instance.endShape(p5Instance.CLOSE)
    p5plot.endSvgGroup();


    p5plot.beginSvgGroup("someText")
    p5Instance.textSize(40)
    p5Instance.textFont("Times")
    p5Instance.textStyle(p5Instance.NORMAL)
    p5Instance.textAlign(p5Instance.LEFT, p5Instance.BASELINE)
    p5Instance.text("Press 's' to save an SVG.", 50, 770);

    p5Instance.textSize(30)
    p5Instance.textAlign(p5Instance.CENTER, p5Instance.BASELINE)
    p5Instance.text("abc", 50, 475)
    p5Instance.textAlign(p5Instance.RIGHT, p5Instance.BASELINE)
    p5Instance.text("abc", 50, 500)
    p5Instance.textAlign(p5Instance.LEFT, p5Instance.BASELINE)
    p5Instance.text("abc", 50, 450)
    // textAlign(LEFT,TOP);    // Not ready for prime time
    // text("top", 100, 450); 
    // textAlign(LEFT,CENTER); // Not ready for prime time
    // text("cen", 100, 450); 
    // textAlign(LEFT,BOTTOM); // Not ready for prime time
    // text("bot", 100, 450); 
    // line(0,450, 150,450); 
    p5plot.endSvgGroup();
  }
  p.setup = function setup() {
    p.createCanvas(612, 792);
    p5plot.setSVGDocumentSize(612, 792); // 6"x8" @ 96dpi
    p5plot.setSvgResolutionDPI(96); // 96 dpi is default. setSvgResolutionDPCM() is also supported. 
    p5plot.setSvgPointRadius(0.25); // a "point" is a 0.25 circle by default
    p5plot.setSvgCoordinatePrecision(4); // how many decimal digits; default is 4
    p5plot.setSvgTransformPrecision(6); // how many decimal digits; default is 6
    p5plot.setSvgIndent(p5plot.SVG_INDENT_SPACES, 2); // or SVG_INDENT_NONE or SVG_INDENT_TABS
    p5plot.setSvgDefaultStrokeColor('black'); 
    p5plot.setSvgDefaultStrokeWeight(1); 
    p5plot.setSvgFlattenTransforms(false); // if true: larger files + greater fidelity to original
  };
  p.keyPressed = ()=>{
     if (p5Instance.key == 's'){ 
      bDoExportSvg = true; 
    }
  }
  
  p.draw = function draw() {
    if (bDoExportSvg) p5plot.beginRecordSVG(p5Instance, "output.svg")
    // p.background(0);
    // p.fill('red');
    // p.rect(x, y, 50, 50);
    drawDesign()
    if (bDoExportSvg) {
      p5plot.endRecordSVG();
      bDoExportSvg = false
    }
  };
}, document.getElementById('app')!);
