# imports
from pathlib import Path, PurePath
import sys  

# Get my_package directory path from Notebook
parent_dir = str(PurePath(Path().resolve(), 'utils'))
# Add to sys.path
sys.path.insert(0, parent_dir)


parent_dir = str(PurePath(Path().resolve().parents[0], 'utils'))
# Add to sys.path
sys.path.insert(0, parent_dir)

import importlib
reload = importlib.reload