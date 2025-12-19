import p5 from 'p5';
import p5plot from 'p5.plotsvg';




import './style.css';
import {draw as drawPlot} from './plots/prova'



// Add sliders to number fields by passing min and max
// gui.add( myObject, 'myNumber', 0, 1 );
// gui.add( myObject, 'myNumber', 0, 100, 2 ); // snap to even numbers

// Create dropdowns by passing an array or object of named values
// gui.add( myObject, 'myNumber', [ 0, 1, 2 ] );
// gui.add( myObject, 'myNumber', { Label1: 0, Label2: 1, Label3: 2 } );





const _app = new p5((p5Instance: p5) => {
  const p = p5Instance as unknown as p5;
  let bDoExportSvg = false
  const x = 100;
  const y = 100;
  
  p.setup = function setup() {
    p.createCanvas(792, 612);
    p5plot.setSVGDocumentSize(792, 612); // 6"x8" @ 96dpi
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
    
    // board.draw(p5Instance)
    if (bDoExportSvg) p5plot.beginRecordSVG(p5Instance, "output.svg")
    p.background(255);
    // p.fill('red');
    // p.rect(x, y, 50, 50);
    // if (c<0){
    drawPlot(p5Instance)
    // c-=1
    // }
    if (bDoExportSvg) {
      p5plot.endRecordSVG();
      bDoExportSvg = false
    }
  };
}, document.getElementById('app')!);
