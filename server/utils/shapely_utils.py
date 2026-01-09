from typing import Any, List, Tuple
from shapely import Polygon, transform, LineString, MultiLineString, GeometryCollection, Point
import shapely as sh
import numpy as np
from scipy.interpolate import splprep, splev
import python_utils as pu
Coord = Tuple[float, float]

# def printg(*args): 
#     return sh.GeometryCollection(*args)
def printg(*args):
    all_args = []
    for arg in args:
        if pu.is_list(arg) and len(arg)>0:
            list_arg = list(arg)
            if pu.is_list(list_arg[0]):
                all_args.append(LineString(list_arg))
            else:
                all_args.append(sh.Point(list_arg))
        else:
            all_args.append(arg)
    return sh.GeometryCollection(all_args)
def copy(geom):
    return sh.affinity.translate(sh.affinity.translate(geom,1),-1)

def size(s):
    a,b,c,d = s.bounds
    w = c-a
    h = d-b
    return w, h

def width(s):
    a,b,c,d = s.bounds
    w = c-a
    return w

def coords(p):
    if (type(p)==sh.Point):
        return list(p.coords)[0]
    if (type(p)==sh.MultiPoint):
        return [(i.x,i.y) for i in list(p.geoms)]
    return list(p.coords)

def geoms(p):
    return list(p.geoms)

def height(s):
    a,b,c,d = s.bounds
    h = d-b
    return h

def first(g):
    if (type(g)==LineString):
        return coords(g)[0]
    return geoms(g)[0]

def last(g):
    if (type(g)==LineString):
        return coords(g)[-1]
    return geoms(g)[-1]

def join(*geoms):
    return GeometryCollection(geoms)

def centroid(g):
    p = list(g.centroid.coords)[0]
    return p

def get_point_at(g, t, tolerance=0.1):
    point_snapped = sh.snap(sh.line_interpolate_point(g, g.length*t), g, tolerance)
    return point_snapped

def deform_line(line, point, force=0.5, curvature=1):
    # for l in lines:
    r = LineString([line.centroid, point])
    newPoint = r.interpolate(r.length*force)
    return curved_path(first(line),last(line), newPoint, curvature)

def segmentize(line, total_chunks):
    lines = []
    last_point = 0
    left = 1-(int(total_chunks)/total_chunks)
    if left>0:
        left /=2
        try:
            lines.append(sliceCurve(line, 0, left))
        except:
            print("too small", left)
    for i in range(int(total_chunks)):
        try:
            lines.append(sliceCurve(line,left+i/total_chunks,left+(i+1)/total_chunks))
        except:
            print("too small", line.length, total_chunks)
        
    if left>0:
        try:
            lines.append(sliceCurve(line, 1-left, 1))
        except:
            print("too small", left)
        # last_point = (i+1)/total_chunks
    # if last_point<0.98:
    #     lines.append(sliceCurve(line,last_point,1))
    return MultiLineString([l for l in lines if not sh.is_empty(l)])
def segmentize_dist(line, dist):
    return segmentize(line,line.length/dist)
def distribute_points(line, n_points):
    return [line.interpolate(line.length*(i/n_points)) for i in range(n_points)]

def create_ellipse(top1, bottom, r, top2=None, num_points=100):
    # aquest tio fa 1000 points
    l1 = LineString([top1,bottom])
    if top2 is None:
        top2 = top1
    l2 = LineString([top2,bottom])
    norm1 = sum_point_vector(l1.centroid,normal_vector(l1), -r )
    norm2 = sum_point_vector(l2.centroid,normal_vector(l2), r )
    c1 = last(norm1)
    c2 = last(norm2)
    curve1 = curved_path(top1,last(l1), c1, 1, num_points)
    curve2 = curved_path(top2,last(l2), c2, 1, num_points)
    return [curve1,curve2]

def sliceCurve(g, start, end=1, num_pieces=100):
    import math
    g = g.segmentize(g.length/num_pieces)
    coords_g = coords(g)
    total_len = len(coords_g)
    index_start =math.floor(start*total_len)
    index_final = math.floor(end*total_len)
    return LineString(coords_g[index_start:index_final])
def sliceLine(g, start, end=1):
    start_p = g.interpolate(start*g.length)
    end_p = g.interpolate(end*g.length)
    return LineString([start_p, end_p])
def sliceLineLength(g, startLength, endLength=None):
    if endLength is None:
        endLength = g.length
    start_p = g.interpolate(startLength)
    end_p = g.interpolate(endLength)
    return LineString([start_p, end_p])
def interpolateTotal(g, distance):
    return g.interpolate(distance*g.length)
def curve_to_ls(curve, steps=50):
    from shapely import Point
    line = []
    for i in range(steps):
        line.append(Point(curve.evaluate(i/steps)))
    return LineString(line)


def move_point_along_line(point, line, distance):
    # Get the position of the point along the line
    current_position = line.project(point)
    # Move the point forward by `distance` units inside the line
    new_position = current_position + distance
    # Ensure the new position does not exceed the line length
    # ensure is inside the line not needed: 
    # new_position = min(new_position, line.length)
    # Get the new point
    moved_point = line.interpolate(new_position)
    return moved_point


def intersection_collection(geo_collection, intersect_geo):
    return GeometryCollection([g.intersection(intersect_geo) for g in geo_collection.geoms])

def break_ls(geom, points, tolerance=0.01):
    # optimize len(list(break_ls(l, a,4).geoms)) in a gridsearch
    from shapely.ops import split
    geoms = None
    if type(geom)!=sh.GeometryCollection:
        geoms = [geom]
    else:
        geoms = geom.geoms
    all_geoms = []
    for g in geoms:
        points_snapped = sh.snap(points, g, tolerance)
        splitted_g = split(g, points_snapped)
        all_geoms += splitted_g.geoms
    return GeometryCollection(all_geoms)

def flatten(geometry, depth=0):
    geoms = []
    if type(geometry) == LineString:
        geoms = [geometry]
    elif type(geometry) == list or type(geometry) == MultiLineString or type(geometry) == GeometryCollection:
        geoms_current = []
        if type(geometry) == list:
            geoms_current = geometry
        else:
            geoms_current = geometry.geoms
        for g in geoms_current:
            geoms += flatten(g, depth+1)
    return geoms

def explode(geo, w, origin=None):
    x_geo_c,y_geo_c = centroid(geo)
    if not (origin is None):
        x_geo_c,y_geo_c = origin
    all_geoms = []
    for g in geo.geoms:
        x_g_c,y_g_c = centroid(g.centroid)
        v_x, v_y =( x_g_c-x_geo_c,y_g_c-y_geo_c)
        norm = (v_x**2+v_y**2)**0.5
        v_x_norm = v_x/norm
        v_y_norm = v_y/norm
        all_geoms.append(sh.affinity.translate(g, v_x_norm*w, v_y_norm*w))
    return GeometryCollection(all_geoms)
def diff(p1,p2):
    if type(p1)==sh.Point:
        p1 = coords(p1)
    if type(p2)==sh.Point:
        p2 = coords(p2)
    return np.array(p2)-np.array(p1)

def repeat_geometry_along_path(g, path, number_of_repetitions,distance=None):
    if number_of_repetitions is None:
        number_of_repetitions = path.length/distance
    points = distribute_points(path, number_of_repetitions)
    initial_point = g.intersection(path)
    all_geos = []
    for p in points:
        v_diff = diff(initial_point, p)
        geo = sh.affinity.translate(g, v_diff[0], v_diff[1])
        all_geos.append(geo)
    return all_geos

def in_axis(ref, point, tolerance=0.1):
    x0,y0 = ref
    xf,yf = point
    if abs(xf-x0)<tolerance:
        return "x"
    if abs(yf-y0)<tolerance:
        return "y"
    return False
def get_quadrant(ref, point):
    x0,y0 = ref
    xf,yf = point
    if (xf<=x0 and yf<=y0):
        return 3
    if (xf>=x0 and yf>=y0):
        return 1
    if (xf<=x0 and yf>=y0):
        return 2
    if (xf>=x0 and yf<=y0):
        return 4
def diff(p1,p2):
    if type(p1)==sh.Point:
        p1 = coords(p1)
    if type(p2)==sh.Point:
        p2 = coords(p2)
    return np.array(p2)-np.array(p1)
def dist(p1,p2):
    a = diff(p1,p2)
    return ((a[0])**2+(a[1])**2)**0.5
def closest_point(list_points, point):
    min_dist = None
    min_p = None
    for p in geoms(list_points):
        diff_p = dist(p, point)
        if min_dist is None:
            min_dist = diff_p
            min_p = p
        else:
            # print(min_dist, diff_p)
            if min_dist>diff_p:
                min_dist = diff_p
                min_p = p
    return min_p
def convex_hull(geo, n_points, donut=False, buffer=None):
    w,h = size(geo)
    circle = Circle(geo.centroid, max(w,h))
    init_points = distribute_points(circle, n_points)
    furthest_coords = []
    for p in init_points:
        # print(p,circle.centroid)
        line = LineString([p,circle.centroid])
        # try:
        point_hull = closest_point(geo.intersection(line), p)
        furthest_coords.append(point_hull) 
    furthest_coords.append(furthest_coords[0])
    holes = None
    if donut:
        holes_coords = []
        for p in init_points:
            line = LineString([p,circle.centroid])
            point_hull = closest_point(geo.intersection(line), circle.centroid)
            holes_coords.append(point_hull)
        holes_coords.append(holes_coords[0])
        line_string_holes = LineString(holes_coords)
        if not buffer is None:
            line_string_holes = line_string_holes.buffer(buffer).exterior

        holes = [line_string_holes]
    line_string_exterior = LineString(furthest_coords)
    if not buffer is None:
        line_string_exterior = list(line_string_exterior.buffer(buffer).interiors)[0]
    return sh.Polygon(line_string_exterior, holes)
def multiply(vector,scalar):
    # if (type(vector)==)
    return [vector[0]*scalar, vector[1]*scalar]
def sum_point_vector(point, vector, scalar=1):
    if type(point)==sh.Point:
        point = coords(point)
    vector = [vector[0]*scalar, vector[1]*scalar]
    return LineString([[point[0], point[1]],[point[0]+vector[0],point[1]+vector[1]]])
def unit_vector(vector):
    import numpy as np
    if (type(vector)==LineString):
        l_0 = first(vector)
        l_f = last(vector)
        vector = [l_f[0]-l_0[0],l_f[1]-l_0[1]]
    """ Returns the unit vector of the vector.  """
    return vector / np.linalg.norm(vector)

def normal_vector(vector):
    if (type(vector)==LineString):
        l_0 = first(vector)
        l_f = last(vector)
        vector = [l_f[0]-l_0[0],l_f[1]-l_0[1]]
    v = unit_vector(vector)
    return (-v[1], v[0])

def angle_between(l1, l2):
    import numpy as np
    """ Returns the angle in radians between vectors 'v1' and 'v2'::

            >>> angle_between((1, 0, 0), (0, 1, 0))
            1.5707963267948966
            >>> angle_between((1, 0, 0), (1, 0, 0))
            0.0
            >>> angle_between((1, 0, 0), (-1, 0, 0))
            3.141592653589793
    """
    l1_0,l1_f = coords(l1)
    v1 = [l1_f[0]-l1_0[0],l1_f[1]-l1_0[1]]
    l2_0,l2_f = coords(l2)
    v2 = [l2_f[0]-l2_0[0],l2_f[1]-l2_0[1]]
    v1_u = unit_vector(v1)
    v2_u = unit_vector(v2)
    return np.arccos(np.clip(np.dot(v1_u, v2_u), -1.0, 1.0))

def reorder_geos(multigeos, key=lambda p: p.centroid.y, top=None, reverse=False,):
    geomsList = multigeos
    returnList = True
    if (type(multigeos)!=list):
        returnList = False
        geomsList = geoms(multigeos)
    func = key
    if (type(key)==str):
        if key=="N":
            func = lambda p: -p.centroid.y
        elif key=="S":
            func = lambda p: p.centroid.y
        elif key=="E":
            func = lambda p: -p.centroid.x
        elif key=="O":
            func = lambda p: p.centroid.x
        else:
            raise Exception("not implemented!")
    geomsList.sort(reverse=reverse, key=func)
    if not top is None:
        geomsList = geomsList[:top]
    if (returnList):
        return geomsList
    return GeometryCollection(geomsList)

def start_at_0(geometry):
    bounds = geometry.bounds
    translate_x = abs(min(bounds[0],0))
    translate_y = abs(min(bounds[1],0))
    geometry_translated = sh.affinity.translate(geometry, translate_x,translate_y)
    return geometry_translated

def resize(geo, new_size, maintain_proportion=True,):
    w,h = size(geo)
    prop_w, prop_h = new_size[0]/w, new_size[1]/h
    if prop_w>1 and prop_h<1 or prop_w<1 and prop_h>1:
        print('cant')
        return geo
    if maintain_proportion:
        if prop_w>1:
            max_w_h = max(prop_w,prop_h)
            prop_w = max_w_h
            prop_h = max_w_h
        if prop_w<1:
            min_w_h = min(prop_w,prop_h)
            prop_w = min_w_h
            prop_h = min_w_h
    return sh.affinity.scale(geo,prop_w,prop_h, )




def createSpring(circle_1, circle_2, prev=False, final=False):
    first_curve = sliceCurve(circle_1,0,0.25) 
    c_point = last(first_curve)
    last_curve = sliceCurve(circle_2,0.75)   
    d_point = first(last_curve)
    diam_new_circle = LineString([c_point, d_point])
    # return GeometryCollection([first_curve,])
    middle_curve = sliceCurve(Circle(diam_new_circle.centroid, diam_new_circle.length/2), 0.25, 0.75)
    total_spring = [first_curve,middle_curve,last_curve]
    if (prev):
        total_spring = [sliceCurve(circle_1,0.75)]+total_spring
    if (final):
        total_spring = total_spring+[sliceCurve(circle_2,0,0.25)]
    all_coords = []
    for l in total_spring:
        all_coords += coords(l)
    return LineString(all_coords)

def line_merge(list_geos, return_ls=True):
    if type(list_geos)==sh.GeometryCollection or type(list_geos)==sh.MultiLineString:
        list_geos = geoms(list_geos)
    final_list = []
    for i, g1, g2 in pu.iter_two(list_geos, enumerate=True):
        # return g1,g2
        if i==0:
            final_list.append(g1)
        # TODO fer que agafi el mes close dels dos
        final_list.append(LineString([last(g1), first(g2)]))
        final_list.append(g2)
    if return_ls:
        return LineString(list([c for g in final_list for c in coords(g)]))
    return MultiLineString(final_list)

def translate_absolute(geo, new_x, new_y):
    x_min,y_min,x_max,y_max = geo.bounds
    xoff = new_x-x_min
    yoff = new_y-y_min
    return sh.affinity.translate(geo,xoff,yoff)

def plot_grid(geo, padding=(0,0,0,0), rows=1, cols=1, box=False):
    padding_top,padding_right,padding_bottom,padding_left=padding
    # start_geo = sh.affinity.translate(geo, padding_top, padding_right)
    geo_item = geo
    if type(geo)==list:
        geo_item = geo[0]
    x_min,y_min,x_max,y_max = geo_item.bounds
    current_x, current_y = (x_min,y_min)
    resulting_geos = []
    k = 0
    for i in range(0,rows):
        current_x = 0
        for j in range(0,cols):
            geo_item = geo
            if type(geo)==list:
                geo_item = geo[k]
            w,h = size(geo_item)
            w_rect = w+padding_right+padding_left
            h_rect = h+padding_bottom+padding_top
            
            new_geo = translate_absolute(geo_item, current_x+padding_left, current_y+padding_bottom)
            if box:
                rect = Rect((current_x,current_y), w_rect, h_rect).boundary
                new_geo = GeometryCollection([new_geo,rect])
            resulting_geos.append(new_geo)
            current_x += w_rect
            k += 1
        current_y += h_rect
    if len(resulting_geos)==1:
        return resulting_geos[0]
    return resulting_geos
def spring(line, num_loops, radius=None, prop_length=1,  invert=False, extra_vertical_first=0, extra_vertical_last=0):
    import math
    if (radius is None):
        radius = line.length/(num_loops+1)
    # radius = 0.25*num_loops
    q = get_quadrant(first(line),last(line))
    if (q>=3):
        line = LineString([last(line),first(line)])
    all_circles = []
    centroid_length = (line.length-2*radius)/(num_loops-1)
    for i in range(num_loops):
        circle = Circle((centroid_length*(i)+radius,0), radius)
        all_circles.append(circle)
    line_guide = LineString([[0,0],[(line.length),0]])
    
    # return all_geo
    
    springs = []
    i = 0
    for c1, c2 in pu.iter_two(all_circles):
        springs.append(createSpring(c1, c2, i==0, i==(len(all_circles)-2)))
        i+=1
    
    final_g = GeometryCollection(springs+[line_guide])
    # return final_g
    x,y = coords(line.centroid)
    angle = angle_between(line_guide, line)
    x_0,y_0 = first(line)
    x_f,y_f = last(line)
    final_g = sh.affinity.translate(final_g,x_0,y_0)
    final_g = sh.affinity.rotate(final_g, angle, (x_0,y_0),True)
    if (q>=3):
        prop_length *= -1
    if (invert):
        prop_length *= -1
    final_g = sh.affinity.scale(final_g, prop_length,prop_length) 
    line_guide_rotated = geoms(final_g)[-1]
    patilles = []
    final_geos = geoms(final_g)[:-1]
    if (extra_vertical_first>0 or extra_vertical_last>0):
        # normal_vector(line_guide)
        patilles += [
            sum_point_vector(first(line_guide_rotated),normal_vector(line_guide_rotated), -extra_vertical_first).reverse(),
            sum_point_vector(last(line_guide_rotated),normal_vector(line_guide_rotated), -extra_vertical_last)
        ]
        final_geos = [patilles[0]]+final_geos+[patilles[1]]
    
    return line_merge(GeometryCollection(final_geos))
    # return final_g
# line = LineString([(0,0),(25,25),])
# printg([line,spring(line, 5, None,0.8)])

def filter_tangent_condition(ref, condition = lambda x,y:True, segmentize=None):
    if not segmentize is None:
        ref = ref.segmentize(segmentize)
    points = [sh.Point(c) for c in coords(ref)]
    slopes = [((second.y-first.y),(second.x-first.x)) for first, second in pu.iter_two(points)]
    filter_slope = condition
    slope_index_selected = []
    is_currently_ok = False
    starting_point = None
    for i,x_y in enumerate(slopes):
        x,y=x_y
        is_i_ok = filter_slope(x,y)
        if (is_i_ok):
            if (is_currently_ok):
                pass
            else:
                starting_point = i
                is_currently_ok = True
        elif (is_currently_ok):
            slope_index_selected.append((starting_point, i))
            starting_point = None
            is_currently_ok = False
        else:
            pass
    if is_currently_ok:
        slope_index_selected.append((starting_point, i))
    from shapely.ops import split
    # snapped_points = [sh.snap(p, ref, tolerance) for p in points]
    geos_ok = []
    for i,j in slope_index_selected:
        splitted = split(ref, sh.MultiPoint([points[i],points[j]])).geoms
        if len(splitted)==1:
            print('splitting none')
        if len(splitted)!=3:
            print('error!')
        else:
            geo_ok = splitted[1]
            geos_ok.append(geo_ok)
    return MultiLineString(geos_ok)

def get_autotolerance(line, point):
    for tolerance in np.arange(0,20,0.1):
        if line.buffer(tolerance).intersects(point):
            return tolerance


def interpolate_shapely_lines(
    line1: LineString,
    line2: LineString,
    num_interpolation_points: int,
    t: float
) -> LineString:
    """
    Interpolates between two Shapely LineString objects.

    It samples points at equal normalized distances along each line,
    interpolates between corresponding points, and constructs a new
    LineString from the interpolated points.

    Args:
        line1: The first Shapely LineString object.
        line2: The second Shapely LineString object.
        num_interpolation_points: The number of points to sample along each line
                                  (including start and end). Must be >= 2.
                                  The output LineString will have this many vertices.
        t: The interpolation factor (0.0 means line1, 1.0 means line2).

    Returns:
        A new Shapely LineString representing the interpolation.

    Raises:
        ValueError: If num_interpolation_points is less than 2.
    """
    if num_interpolation_points < 2:
        raise ValueError("Number of interpolation points must be at least 2.")
    if not (0 <= t <= 1):
         print(f"Warning: Interpolation factor t={t} is outside the typical [0, 1] range.")

    interpolated_coords: List[Coord] = []

    for i in range(num_interpolation_points):
        # Calculate the normalized distance (fraction) along the lines
        fraction = i / (num_interpolation_points - 1)

        # Get the points at this fraction along each line
        p1_geom: Point = line1.interpolate(fraction, normalized=True)
        p2_geom: Point = line2.interpolate(fraction, normalized=True)

        # Extract coordinates as NumPy arrays for interpolation
        # Shapely Point coords is a tuple containing one coordinate tuple ((x, y),)
        coords1 = np.array(p1_geom.coords[0])
        coords2 = np.array(p2_geom.coords[0])

        # Perform linear interpolation between the coordinates
        interp_coords_np = coords1 + t * (coords2 - coords1)

        # Convert back to a standard tuple for LineString creation
        interpolated_coords.append(tuple(interp_coords_np))

    # Create the new LineString from the interpolated coordinates
    if len(interpolated_coords) < 2:
         # This case should theoretically not happen if num_interpolation_points >= 2
         # but handle defensively. Return an empty LineString or raise error?
         # Let's return a LineString with the single point repeated if num_points=1 was allowed,
         # but since we enforced >=2, we expect >= 2 coords here.
         # If somehow only one point resulted, LineString constructor might fail.
         print("Warning: Could not generate enough points for a valid LineString.")
         return LineString() # Return empty linestring


    return LineString(interpolated_coords)
def curved_path(a, b, c, curvature=1.0, num_points=100):
    """
    Returns a LineString passing through A, C, B.
    curvature = 0 -> sharp corner at C
    curvature = 1 -> smooth curve through A-C-B
    """
    if (type(a)==sh.Point):
        a = coords(a)
    if (type(b)==sh.Point):
        b = coords(b)
    if (type(c)==sh.Point):
        c = coords(c)
    # Ensure inputs are float arrays
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    c = np.array(c, dtype=float)

    # Control how many intermediate points to use
    points = np.array([a, c, b])

    # Determine smoothing: 0 = interpolate exactly through all, higher = smoother
    smoothness = (1 - curvature) * 1e-2  # tiny smoothing when curvature ~1

    # Create a parameterized spline through A, C, B
    tck, _ = splprep(points.T,k=2)
    u_fine = np.linspace(0, 1, num_points)
    x_fine, y_fine = splev(u_fine, tck)
    # print(x_fine,y_fine)
    # print(a,b,c)
    curved = LineString(zip(x_fine, y_fine))
    straight = LineString([a,c,b])
    resolution = num_points
    import pdb
    # try:
    coords_all = interpolate_shapely_lines(curved, straight, resolution, 1-curvature)
    # except:
    #     pdb.set_trace()
    
    return LineString(coords_all)

def gaussian(x, x_max=1.0, sigma=1.0, y_max=1.0,):
    import math
    return y_max * math.exp(-((x - x_max)**2) / (2 * sigma**2))
def gaussian_generator( x_max=1.0, sigma=1.0, y_max=1.0,):
    return lambda x: gaussian(x,  x_max=x_max, sigma=sigma, y_max=y_max)

def linear_generator( x_max=1.0, y_max=1.0,):
    return lambda x: x*(y_max/(x_max-1))
def force_iterator(list_, *force_):
    forces_list = []
    for f in force_:
        force_result = []
        for i in range(len(list_)):
            force_result.append(f(i))
        forces_list.append(force_result)
    return zip(list_,*forces_list)
class StructuredCollection():
    def __init__(self, **kwargs):
        self.self_dict = {}
        self.geo = None
        try:
            self.self_dict = {k:v if type(v)!=list else GeometryCollection(v) for k,v in kwargs.items()}
            self.refresh_geo()
        except Exception as e:
            print(f"Error during initialization: {e}")
            raise  # Re-raise the exception for better debugging
    def keys(self):
        return self.self_dict.keys()
    def entries(self):
        return self.self_dict.keys()
    def __getitem__(self, name):
        if name in self.self_dict:
            return self.self_dict[name]
        else:
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
    def refresh_geo(self):
        self.geo = GeometryCollection(list(self.self_dict.values()))
    def __setitem__(self, name: str, value):
        self.self_dict[name] = value
        self.refresh_geo()
    def values(self):
        return self.self_dict.values()
    def rotate(self, angle, origin=None, use_radians=False):
        if origin is None:
            origin = self.geo.centroid
        self.geo = sh.affinity.rotate(self.geo, angle, origin, use_radians)
        self.self_dict = {k: sh.affinity.rotate(v, angle, origin, use_radians) for k, v in self.self_dict.items()}
        return self
    def translate(self, xoff, yoff, zoff=0.0):
        self.geo = sh.affinity.translate(self.geo, xoff, yoff, zoff)
        self.self_dict = {k: sh.affinity.translate(v, xoff, yoff, zoff) for k, v in self.self_dict.items()}
        return self
    def scale(self, xfact=1.0, yfact=1.0, zfact=1.0, origin='center'):
        if origin == 'center':
            origin = self.geo.centroid
        self.geo = sh.affinity.scale(self.geo, xfact=xfact, yfact=yfact, zfact=zfact, origin=origin)
        self.self_dict = {k: sh.affinity.scale(v, xfact=xfact, yfact=yfact, zfact=zfact, origin=origin) for k, v in self.self_dict.items()}
        return self
# def StructuredCollection(**kwargs):
#     # print(kwargs)
#     newKwargs = {k:v if type(v)!=list else GeometryCollection(v) for k,v in kwargs.items()}    
#     return dict(**kwargs) 

def Circle(center, radius):
    if (type(center)!=sh.Point):
        center = sh.Point(center)
    return sh.affinity.rotate(center.buffer(radius), 90).boundary

def Rect(point,w,h, centroid=False):
    x,y=(None,None)
    if type(point)==sh.Point:
        x,y = list(point.coords[0])
    else:
        x,y = point
    if centroid:
        return sh.Polygon(([x-w/2,y-h/2], [x-w/2,y+h/2], [x+w/2,y+h/2], [x+w/2,y-h/2], [x-w/2,y-h/2]))    
    return sh.Polygon(([x,y], [x,y+h], [x+w,y+h], [x+w,y], [x,y]))


def bulls_eye(center, size):
    center_x, center_y = center
    g1 = Rect((center_x, center_y),size,size, True).boundary
    g2 = Circle((center_x, center_y), size/3)
    size_lines = 1.2*size/2
    g3 = sh.LineString([(center_x-size_lines, center_y),(center_x+size_lines, center_y)])
    g4 = sh.LineString([(center_x, center_y-size_lines),(center_x, center_y+size_lines)])
    return printg(g1,g2, g3,g4)