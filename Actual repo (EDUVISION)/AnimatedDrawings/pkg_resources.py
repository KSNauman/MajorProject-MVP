import os
import sys

def resource_filename(package_or_requirement, resource_name):
    """Fallback compatibility shim for pkg_resources.resource_filename on Python 3.12+"""
    if isinstance(package_or_requirement, str) and package_or_requirement in sys.modules:
        mod = sys.modules[package_or_requirement]
        if hasattr(mod, '__file__') and mod.__file__:
            return os.path.normpath(os.path.join(os.path.dirname(mod.__file__), resource_name))
    return os.path.normpath(resource_name)
