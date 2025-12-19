import p5 from 'p5';
import { Board } from '../components/Board';
import { drawFlatten } from '../utils';
import {point, circle, segment, line} from '@flatten-js/core';
let board: Board|null = null
export function draw (p5Instance:p5){
    if (!board) board = new Board(p5Instance,{width:500, height:300, margin: 5, 
      colorBoard: {
        sizeX:30,
        sizeY:40,
        marginX:10,
        marginY:20,
        paddingX: 4,
        paddingY: 2, 
        colors: [["red", "blue"], ["green", "yellow"]] 
      }
    })
    board.draw()
    
    let a = board.addLayer("squares").beginLayer()
    if (a.visible){
      let s = segment(0,0, 100, 100)
      drawFlatten(p5Instance, s)
      // p5Instance.rectMode(p5Instance.CORNER)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CENTER)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CORNERS)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.RADIUS)
      // p5Instance.square(100, 250, 50)
      // p5Instance.rectMode(p5Instance.CENTER)
      // p5Instance.rect(75, 350, 100, 50)
      // p5Instance.rectMode(p5Instance.CORNER)
      // p5Instance.rect(75, 350, 100, 50)
    }
    a.closeLayer();

    // Tests of circles and ellipses with various ellipseModes
    const b = board.addLayer("circles").beginLayer()
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
    b.closeLayer()
  }

