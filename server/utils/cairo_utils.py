"""Helpers for drawing in Jupyter notebooks with PyCairo."""
import shapely as sh
import shapely_utils as shu
import python_utils as pu
import contextlib
import io
import math
import os.path
from matplotlib import colors
import cairo
import IPython.display

colorLabels = colors 
# Compass points for making circle arcs
DEG90 = math.pi / 2
DEG180 = math.pi
CE, CS, CW, CN = [i * DEG90 for i in range(4)]


class _CairoContext:
    """Base class for Cairo contexts that can display in Jupyter, or write to a file."""

    def __init__(self, width: int, height: int, output: str | None = None):
        self.width = width
        self.height = height
        if isinstance(output, str):
            self.output = os.path.expandvars(os.path.expanduser(output))
        else:
            self.output = output
        self.surface = None
        self.ctx = None

    def _repr_pretty_(self, p, cycle_unused):
        """Plain text repr for the context."""
        # This is implemented just to limit needless changes in notebook files.
        # This gets written to the .ipynb file, and the default includes the
        # memory address, which changes each time.  This string does not.
        p.text(f"<{self.__class__.__module__}.{self.__class__.__name__}>")

    def _repr_html_(self):
        """
        HTML display in Jupyter.

        If output went to a file, display a message saying so.  If output
        didn't go to a file, do nothing and the derived class will implement a
        method to display the output in Jupyter.
        """
        if self.output is not None:
            return f"<b><i>Wrote to {self.output}</i></b>"

    def __enter__(self):
        return self

    def __getattr__(self, name):
        """Proxy to the cairo context, so that we have all the same methods."""
        return getattr(self.ctx, name)

    # Drawing helpers

    def circle(self, x, y, r):
        """Add a complete circle to the path."""
        self.ctx.arc(x, y, r, 0, 2 * math.pi)

    @contextlib.contextmanager
    def save_restore(self):
        self.ctx.save()
        try:
            yield
        finally:
            self.ctx.restore()

    @contextlib.contextmanager
    def flip_lr(self, wh):
        with self.save_restore():
            self.ctx.translate(wh, 0)
            self.ctx.scale(-1, 1)
            yield

    @contextlib.contextmanager
    def flip_tb(self, wh):
        with self.save_restore():
            self.ctx.translate(0, wh)
            self.ctx.scale(1, -1)
            yield

    @contextlib.contextmanager
    def rotated(self, wh, nturns):
        with self.save_restore():
            self.ctx.translate(wh / 2, wh / 2)
            self.ctx.rotate(math.pi * nturns / 2)
            self.ctx.translate(-wh / 2, -wh / 2)
            yield


class _CairoSvg(_CairoContext):
    """For creating an SVG drawing in Jupyter."""

    def __init__(self, width: int, height: int, output: str | None = None):
        super().__init__(width, height, output)
        self.svgio = io.BytesIO()
        self.surface = cairo.SVGSurface(self.svgio, self.width, self.height)
        self.surface.set_document_unit(cairo.SVGUnit.PX)
        self.ctx = cairo.Context(self.surface)

    def __exit__(self, typ, val, tb):
        self.surface.finish()
        if self.output is not None:
            with open(self.output, "wb") as svgout:
                svgout.write(self.svgio.getvalue())

    def _repr_svg_(self):
        if self.output is None:
            return self.svgio.getvalue().decode()


class _CairoPng(_CairoContext):
    """For creating a PNG drawing in Jupyter."""

    def __init__(self, width: int, height: int, output: str | None = None):
        super().__init__(width, height, output)
        self.pngio = None
        self.surface = cairo.ImageSurface(cairo.Format.RGB24, self.width, self.height)
        self.ctx = cairo.Context(self.surface)

    def __exit__(self, typ, val, tb):
        if self.output is not None:
            self.surface.write_to_png(self.output)
        else:
            self.pngio = io.BytesIO()
            self.surface.write_to_png(self.pngio)
        self.surface.finish()

    def _repr_png_(self):
        if self.output is None:
            return self.pngio.getvalue()


def cairo_context(
    width: int, height: int, format: str = "svg", output: str | None = None
):
    """
    Create a PyCairo context for use in Jupyter.

    Arguments:
        width (int), height (int): the size of the drawing in pixels.
        format (str): either "svg" or "png".
        output (optional str): if provided, the output will be written to this
            file.  If None, the output will be displayed in the Jupyter notebook.

    Returns:
        A PyCairo context proxy.
    """

    if format == "svg":
        cls = _CairoSvg
    elif format == "png":
        cls = _CairoPng
    else:
        raise ValueError(f"Unknown format: {format!r}")
    return cls(width, height, output)


def svg_row(*svgs):
    sbs = '<div style="display:flex; flex-direction: row; justify-content: space-evenly">{}</div>'
    return IPython.display.HTML(sbs.format("".join(s._repr_svg_() for s in svgs)))


def get_context(size=(200,200),mode='jupyter', file_name='example'):
    ctx = None
    if(mode=='jupyter'):
        ctx = cairo_context(size[0], size[1], format="svg") 
    if(mode=='svg'):
        surface = cairo.SVGSurface(file_name+".svg", size[0], size[1])
        ctx = cairo.Context(surface)
    return ctx


def plot_graphic(ctx, geometry, depth=0, normalize_size=None, line_width=0.01):
    # TODO: troba manera bona de fer normalization
    if normalize_size is None:
        w,h = shu.size(geometry)
        if w<=1 and h<=1:
            normalize_size = (1.0,1.0)
        else:
            normalize_size = (w,h)
    
    size_x = normalize_size[0]
    size_y = normalize_size[1]
    # print(normalize_size)
    # print(type(geometry))
    # if depth == 0:
    #     bounds = geometry.bounds
    #     translate_x = abs(min(bounds[0],0))
    #     translate_y = abs(min(bounds[1],0))
    #     geometry_translated = sh.affinity.translate(geometry, translate_x+starting_point[0],translate_y+starting_point[1])
    #     geometry = geometry_translated
    if type(geometry)==sh.Polygon:
        geometry = geometry.boundary
    if type(geometry) == sh.LineString:
        for i,coords in enumerate(geometry.coords):
            x,y=coords
            if (i==0):
                # print('move_to',x,y)
                ctx.move_to(x/size_x,y/size_y)
            else:
                # print('line_to',x,y,size)
                ctx.line_to(x/size_x,y/size_y)
    elif type(geometry) == sh.MultiLineString or type(geometry) == sh.GeometryCollection:
        for g in geometry.geoms:
            plot_graphic(ctx, g, depth+1,normalize_size)
    # elif (type())
    if depth==0:
        ctx.set_line_width(line_width)
        ctx.stroke()
    return ctx

def create_artwork(aw, colored_, x_margin=0.1,y_margin=0.1,mode='jupyter', file_name='artwork'):
    colored = colored_
    geo = shu.printg(*pu.flat(aw.values()))
    # geo = sh.affinity.scale(geo, 38, 38)
    xmin,ymin,xmax,ymax = geo.bounds
    xmin = min(xmin,0)
    ymin = min(ymin,0)
    extra_x = abs(xmin)
    extra_y = abs(ymin)
    # geo = sh.affinity.translate(geo, , abs(ymin))
    # xmin,ymin,xmax,ymax = geo.bounds
    # geo_width,geo_height  = (abs(xmax-xmin),abs(ymax-ymin))
    
    geo_width,geo_height = shu.size(geo)
    x_margin_total = x_margin*geo_width
    y_margin_total = y_margin*geo_height
    marc_width = geo_width+2*x_margin_total
    marc_height = geo_height+2*y_margin_total
    marc = shu.Rect(geo.centroid, marc_width, marc_height, True).boundary
    context = get_context(size=(marc_width,marc_height),mode=mode, file_name=file_name)
    def plot_with_ctx(ctx, colored):
        ctx.scale(marc_width,marc_height)
        if colored is None:
            colored = {k:'black' for k,v in colored.items()}
            colored['background'] = 'white'
        if colored['background']:
            ctx.rectangle(0, 0, marc_width, marc_height)  # Rectangle(x0, y0, x1, y1)
            ctx.set_source_rgba(*colors.to_rgba(colored['background']))
            ctx.fill()
        
        for color_k,color in colored.items():
            if color_k == 'background':
                continue
            geo_item = aw[color_k]
            if pu.iterable(geo_item):
                geo_item = sh.GeometryCollection(geo_item)
            # geo_item = sh.affinity.scale(geo_item, 38, 38)
            geo_item = sh.affinity.translate(geo_item, extra_x+x_margin_total,extra_y+y_margin_total)
            # ctx.set_line_width(.1)
            # color = 'black'
            # if not colored is None and k in colored:
            #     color = colored[k]
            color_array = colors.to_rgba(color)
            
            ctx.set_source_rgba(*color_array)
            # ctx.set_line_width(0.01)
            plot_graphic(ctx, geo_item, normalize_size=(marc_width,marc_height),line_width=0.003)
    if (mode=='jupyter'):
        with context as ctx:
            # if mode=='jupyter':
            plot_with_ctx(ctx,colored)
            return ctx
    plot_with_ctx(context,colored)