import p5 from 'p5';
import p5plot from 'p5.plotsvg';




import './style.css';
import { Plot} from './plots/260225_cycles';
import { DisplayMode, DPI, PAPER_SIZES, Plot as PlotType } from './components/Plot';
const PlotSettings = Plot






// let displayMode = DisplayMode.FULLSCREEN;

// Add sliders to number fields by passing min and max
// gui.add( myObject, 'myNumber', 0, 1 );
// gui.add( myObject, 'myNumber', 0, 100, 2 ); // snap to even numbers

// Create dropdowns by passing an array or object of named values
// gui.add( myObject, 'myNumber', [ 0, 1, 2 ] );
// gui.add( myObject, 'myNumber', { Label1: 0, Label2: 1, Label3: 2 } );
let [width, height]: [number|null,number|null] = [null,null];
function computeCanvas(p: p5) {
  if (PlotSettings.displayMode === DisplayMode.PRINT) {
    p.resizeCanvas(PlotSettings.paper!.w, PlotSettings.paper!.h);
    ([width, height]=[PlotSettings.paper!.w, PlotSettings.paper!.h]);
    return { scale: 1 };
  }

  // FULLSCREEN mode
  const sx = p.windowWidth / PAPER_SIZES.A4_h.w;
  const sy = p.windowHeight / PAPER_SIZES.A4_h.h;
  const scale = Math.min(sx, sy);

  p.resizeCanvas(p.windowWidth, p.windowHeight);
  ([width, height]=[p.windowWidth, p.windowHeight]);

  return { scale };
}
let plot: Plot
new p5((p5Instance: p5) => {
  
  const p = p5Instance as unknown as p5;
  let bDoExportSvg = false
  // let drawScale = 1
  p.setup = function setup() {
    p.createCanvas(PAPER_SIZES.A4_h.w, PAPER_SIZES.A4_h.h);
    computeCanvas(p);
    p5plot.setSVGDocumentSize(width, height);
    // DPI constant for all plots
    p5plot.setSvgResolutionDPI(DPI);
    // p5plot.setSVGDocumentSize(792, 612); // 6"x8" @ 96dpi
    // p5plot.setSvgResolutionDPI(96); // 96 dpi is default. setSvgResolutionDPCM() is also supported. 
    p5plot.setSvgPointRadius(0.25); // a "point" is a 0.25 circle by default
    p5plot.setSvgCoordinatePrecision(4); // how many decimal digits; default is 4
    p5plot.setSvgTransformPrecision(6); // how many decimal digits; default is 6
    p5plot.setSvgIndent(p5plot.SVG_INDENT_SPACES, 2); // or SVG_INDENT_NONE or SVG_INDENT_TABS
    p5plot.setSvgDefaultStrokeColor('black'); 
    p5plot.setSvgDefaultStrokeWeight(1); 
    p5plot.setSvgFlattenTransforms(false); // if true: larger files + greater fidelity to original
    plot = new Plot({p5: p5Instance}, {
      x:0,
      y:0,
      height: height!,
      width: width!, 
      saveSVG:()=>bDoExportSvg=true
    })
  }
  p.keyPressed = ()=>{
     if (p5Instance.key == 's'){ 
      bDoExportSvg = true; 
    }
  }
  
  p.draw = function draw() {
    
    // board.draw(p5Instance)
    if (bDoExportSvg) {
      p5plot.beginRecordSVG(p5Instance, "output.svg")
      // beginrecord resets svgheader
      p5plot.injectSvgHeaderAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape")
    }
    p.background(255);
    // p.fill('red');
    // p.rect(x, y, 50, 50);
    // if (c<0){
    plot.draw()
    // c-=1
    // }
    if (bDoExportSvg) {
      p5plot.endRecordSVG();
      bDoExportSvg = false
    }
  };
}, document.getElementById('app')!);
