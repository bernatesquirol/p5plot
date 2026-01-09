## NO PIP ALLOWED
def slow_read(file, sep=';', line_sep="\n"):
        # utilitzem ¶ §
        with open(file, "r", encoding='utf8') as f:
            st = f.read()
    #         return st
        db = []
        rows = st.split(line_sep)
        len_fields = len(rows[0].split(sep))
    
        for i,k in enumerate(rows):
            try:
                values = k.split(sep)
                if (len(values)==len_fields):
                    db.append(values)
                else:
                    print(i,len(values),len_fields)
    #                 break
            except:
                pass
    #             print(i,values)
        return db
def iterable(arg):
    from collections.abc import Iterable
    import six
    return (
        isinstance(arg, Iterable) 
        and not isinstance(arg, six.string_types)
    )

def flat(list_):
    return_value = []
    for a in list_:
        if iterable(a):
            return_value+=flat(a)
        else:
            return_value.append(a)
    return return_value
class DotMap(dict):
    """dot.notation access to dictionary attributes"""
    __getattr__ = dict.get
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__
    def to_dict(self):
        return dict(**self)


import json
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)
def is_sequence(maybe_list):
    import collections.abc
    return isinstance(maybe_list, collections.abc.Sequence)

def write_file(file, content):
    if (not is_sequence(content)):
        content=[content]
    f = open(file, "a")
    f.writelines([str(k) for k in content])
    f.close()

def write_json(path, json_obj, **kwargs):
    import json
    json_object_str = json.dumps(json_obj, cls=NpEncoder, **kwargs)
    # Writing to sample.json
    with open(path, "w") as outfile:
        outfile.write(json_object_str)


def read_json(path):
    import json
    # Opening JSON file
    with open(path, 'r') as openfile:
        # Reading from json file
        json_object = json.load(openfile)
    return json_object

def zip_folder(dir_name):
    import shutil
    shutil.make_archive(f"{dir_name}.zip", 'zip', dir_name)

def reload(lib):
    import importlib
    importlib.reload(lib)

def chunk_list(original_list, chunk_size=2):
    if type(original_list)!=list:
        original_list = list(original_list)
    result = [original_list[i:i+chunk_size] for i in range(0, len(original_list), chunk_size)]
    return result

def iter_two(list_, enumerate=False):
    if type(list_)!=list:
        list_ = list(list_)
    if enumerate:
        return list(zip(range(len(list_)-1),list_[:-1], list_[1:]))
    return list(zip(list_[:-1], list_[1:]))

def is_list(x):
    import collections
    if not isinstance(x, collections.abc.Iterable) or isinstance(x, (str, bytes, dict)):
        return False
    return True

import random

def split_randomly(lst, n):
    """
    Splits the input list `lst` into `n` random sublists of as equal length as possible.
    """
    if n <= 0:
        raise ValueError("n must be a positive integer")
    lst_copy = lst[:]  # To avoid modifying the original list
    random.shuffle(lst_copy)
    avg = len(lst_copy) // n
    remainder = len(lst_copy) % n
    result = []
    start = 0
    for i in range(n):
        end = start + avg + (1 if i < remainder else 0)
        result.append(lst_copy[start:end])
        start = end
    return result
