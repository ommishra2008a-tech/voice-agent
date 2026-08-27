"""
Model Management Subsystem
Enforces Single-Model-At-A-Time GPU Execution for 6GB RTX 3050 VRAM Budget
"""
import gc
import time
from typing import Optional, Dict, Any


class ModelManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance.loaded_models: Dict[str, Any] = {}
            cls._instance.active_model_name: Optional[str] = None
        return cls._instance

    def get_device(self) -> str:
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except Exception:
            pass
        return "cpu"

    def get_vram_usage(self) -> Dict[str, Any]:
        try:
            import torch
            if torch.cuda.is_available():
                allocated = torch.cuda.memory_allocated() / (1024 * 1024)
                reserved = torch.cuda.memory_reserved() / (1024 * 1024)
                total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
                return {
                    "cuda_available": True,
                    "device_name": torch.cuda.get_device_name(0),
                    "allocated_mb": round(allocated, 2),
                    "reserved_mb": round(reserved, 2),
                    "total_mb": round(total, 2),
                    "free_mb": round(total - allocated, 2)
                }
        except Exception:
            pass
        return {
            "cuda_available": False,
            "device_name": "CPU",
            "allocated_mb": 0.0,
            "reserved_mb": 0.0,
            "total_mb": 0.0,
            "free_mb": 0.0
        }

    def cleanup_gpu(self):
        """Forces immediate GPU cache eviction and garbage collection."""
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass

    def switch(self, model_key: str):
        """Switches active model by evicting inactive models from VRAM."""
        if self.active_model_name and self.active_model_name != model_key:
            self.unload_all()
        self.active_model_name = model_key

    def unload(self, model_key: str):
        self.unload_model(model_key)

    def unload_all(self):
        """Unloads all cached models to ensure 100% clean VRAM baseline."""
        self.loaded_models.clear()
        self.active_model_name = None
        self.cleanup_gpu()

    def unload_model(self, model_key: str):
        if model_key in self.loaded_models:
            del self.loaded_models[model_key]
        if self.active_model_name == model_key:
            self.active_model_name = None
        self.cleanup_gpu()


model_manager = ModelManager()
