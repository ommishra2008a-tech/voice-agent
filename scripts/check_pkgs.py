import sys

packages = ["resemblyzer", "librosa", "soundfile", "faster_whisper", "torch", "scipy", "numpy"]
for pkg in packages:
    try:
        mod = __import__(pkg)
        ver = getattr(mod, "__version__", "N/A")
        print(f"{pkg}: INSTALLED ({ver})")
    except ImportError as e:
        print(f"{pkg}: NOT INSTALLED ({e})")
