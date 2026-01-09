from shapely import Polygon, transform, LineString, MultiLineString, GeometryCollection
from nextdraw import NextDraw
import shapely_utils as shu

def init_plotter():

    nd1 = NextDraw()                # Initialize class
    nd1.interactive()               # Enter interactive context
    if not nd1.connect():           # Open serial port to NextDraw;
        # quit()   
        pass
    nd1.options.units = 1
    # nd1.options.pen_pos_down = 32
    nd1.update()
    return nd1

def try_point(plotter, x,y):
    plotter.penup()
    plotter.moveto(x,y)
    plotter.pendown()

def plot(plotter, geometry, startingPoint = (0,0), depth=0):
    if depth == 0:
        plotter.penup()
        # bounds = geometry.bounds
        # translate_x = abs(min(bounds[0],0))
        # translate_y = abs(min(bounds[1],0))
        # geometry_translated = sh.affinity.translate(geometry, translate_x+startingPoint[0],translate_y+startingPoint[1])
        # geometry = geometry_translated
    if type(geometry) == LineString:
        for i,coords in enumerate(geometry.coords):
            x,y=coords
            if (i==0):
                plotter.moveto(x,y)
            else:
                plotter.lineto(x,y)
    elif type(geometry) == MultiLineString or type(geometry) == GeometryCollection:
        for g in geometry.geoms:
            plot(plotter, g, startingPoint, depth+1)
    if depth == 0:
        plotter.penup()
    return geometry

def alignment_manouver(plotter, calibration_point, color="color",):
    plotter.interactive()
    plotter.penup()
    delta = [0,0]
    val = None
    plotter.moveto(calibration_point[0]+delta[0],calibration_point[1]+delta[1])
    while (val!="ok"):
        plotter.pendown()
        val = input("esta be d'alçada (setting pen_pos_down?)")
        
        if val == "ok" or val=="":
            break
        plotter.penup()
        plotter.options.pen_pos_down += int(val)
        plotter.update()
    val = None
    while (val!="ok"):
        plotter.moveto(calibration_point[0]+delta[0],calibration_point[1]+delta[1])
        plotter.pendown()
        val = input("protegeix i coloca el boli bé, "+color)
        
        if val == "ok" or val=="":
            break
        if val == 'q':
            return
        x_y = val.replace("(","").replace(")","").split(",")
        if len(x_y)>1:
            x,y=x_y
            delta[0]+=float(x)/10
            delta[1]+=float(y)/10
        plotter.penup()
    val = None
    # while (val!="ok"):
        
    # val = None
    # plotter.moveto(*calibration_point)
    while (val!="ok"):
        plotter.penup()
        geometry = shu.bulls_eye((calibration_point[0]+delta[0],calibration_point[1]+delta[1]),0.5)
        plot(plotter, geometry)
        val = input("Is it ok rect? (yes == '' / reset / point)")
        if val == 'reset':
            delta = [0,0]
        if val == "ok" or val=="":
            break
        if val == 'q':
            return
        x_y = val.replace("(","").replace(")","").split(",")
        if len(x_y)>1:
            x,y=x_y
            delta[0]+=float(x)/10
            delta[1]+=float(y)/10
    return delta