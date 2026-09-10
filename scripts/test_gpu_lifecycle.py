import sys
import os
import time
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-service")))

from app.providers.model_manager import model_manager
from app.providers.voice_engine import VoiceEngineRegistry
from app.contracts.voice_generation import VoiceGenerationRequest

def main():
    print("=" * 80)
    print("GPU LIFECYCLE & MODEL SWITCHING AUDIT")
    print("=" * 80)

    device = model_manager.get_device()
    print(f"Device: {device}")
    vram0 = model_manager.get_vram_usage()
    print(f"Baseline VRAM: {vram0['allocated_mb']} MB allocated, {vram0['free_mb']} MB free")

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "model-readiness"))
    os.makedirs(out_dir, exist_ok=True)
    ref = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "real_speech_reference_24k.wav"))

    # 1. XTTS v2 Test
    print("\n[1] Testing XTTS v2 Synthesis & VRAM Usage...")
    xtts = VoiceEngineRegistry.get_engine("xtts-v2")
    out1 = os.path.join(out_dir, "xtts_switch_1.wav")
    req1 = VoiceGenerationRequest(
        project_id="audit",
        user_id="audit_user",
        voice_profile_id="audit_profile",
        reference_audio_path=ref,
        text="XTTS v2 is loaded and synthesizing on GPU.",
        model="xtts-v2",
        language="en"
    )
    t0 = time.time()
    res1 = xtts.synthesize(req1, out1)
    t_xtts = time.time() - t0
    vram1 = model_manager.get_vram_usage()
    print(f"XTTS v2 result: status={res1.status}, duration={res1.duration:.2f}s, time={t_xtts:.2f}s")
    print(f"VRAM after XTTS v2: {vram1['allocated_mb']} MB allocated")
    assert res1.status == "COMPLETED"
    assert res1.metadata.get("actualModel") == "xtts-v2"

    # 2. Switch to FastPitch (Evicts XTTS v2)
    print("\n[2] Switching to FastPitch Baseline Synthesizer...")
    fastpitch = VoiceEngineRegistry.get_engine("fastpitch-baseline")
    out2 = os.path.join(out_dir, "fastpitch_switch_2.wav")
    req2 = VoiceGenerationRequest(
        project_id="audit",
        user_id="audit_user",
        voice_profile_id="default",
        text="FastPitch baseline speech synthesizer running after switch.",
        model="fastpitch-baseline",
        language="en"
    )
    t0 = time.time()
    res2 = fastpitch.synthesize(req2, out2)
    t_fp = time.time() - t0
    vram2 = model_manager.get_vram_usage()
    print(f"FastPitch result: status={res2.status}, duration={res2.duration:.2f}s, time={t_fp:.2f}s")
    print(f"VRAM after FastPitch: {vram2['allocated_mb']} MB allocated")
    assert res2.status == "COMPLETED"
    assert res2.metadata.get("actualModel") == "fastpitch-baseline"

    # 3. Test OpenVoice (Must return UNAVAILABLE without executing XTTS)
    print("\n[3] Testing OpenVoice (Strict Non-Fallback)...")
    openvoice = VoiceEngineRegistry.get_engine("openvoice-v2")
    req3 = VoiceGenerationRequest(
        project_id="audit",
        user_id="audit_user",
        voice_profile_id="audit_profile",
        reference_audio_path=ref,
        text="OpenVoice request.",
        model="openvoice-v2",
        language="en"
    )
    res3 = openvoice.synthesize(req3)
    print(f"OpenVoice result: status={res3.status}, error={res3.error}")
    print(f"OpenVoice metadata: {res3.metadata}")
    assert res3.status == "FAILED"
    assert "UNAVAILABLE" in res3.error
    assert res3.metadata.get("actualModel") == "openvoice-v2"
    assert res3.metadata.get("silentFallback") == False

    # 4. Test CosyVoice (Must return UNAVAILABLE without executing XTTS)
    print("\n[4] Testing CosyVoice (Strict Non-Fallback)...")
    cosyvoice = VoiceEngineRegistry.get_engine("cosyvoice")
    req4 = VoiceGenerationRequest(
        project_id="audit",
        user_id="audit_user",
        voice_profile_id="audit_profile",
        reference_audio_path=ref,
        text="CosyVoice request.",
        model="cosyvoice",
        language="en"
    )
    res4 = cosyvoice.synthesize(req4)
    print(f"CosyVoice result: status={res4.status}, error={res4.error}")
    print(f"CosyVoice metadata: {res4.metadata}")
    assert res4.status == "FAILED"
    assert "UNAVAILABLE" in res4.error
    assert res4.metadata.get("actualModel") == "cosyvoice"
    assert res4.metadata.get("silentFallback") == False

    # 5. Switch back to XTTS v2
    print("\n[5] Switching Back to XTTS v2...")
    out5 = os.path.join(out_dir, "xtts_switch_back.wav")
    res5 = xtts.synthesize(req1, out5)
    vram5 = model_manager.get_vram_usage()
    print(f"XTTS v2 switch-back result: status={res5.status}, duration={res5.duration:.2f}s")
    print(f"VRAM after switch-back: {vram5['allocated_mb']} MB allocated")
    assert res5.status == "COMPLETED"

    # 6. Clean Unload
    print("\n[6] Unloading All Models from GPU...")
    model_manager.unload_all()
    vram_end = model_manager.get_vram_usage()
    print(f"Final VRAM: {vram_end['allocated_mb']} MB allocated")

    print("\n" + "=" * 80)
    print("ALL GPU LIFECYCLE & MODEL SWITCHING CHECKS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    main()
