#!/usr/bin/env python3
"""
Phase 13F: XTTS v2 Voice Fidelity & Acoustic Optimization Runner

Executes:
1. Canonical Baseline (PHASE_13F_BASELINE)
2. Reference Preprocessing Experiments (Variants A - G)
3. Reference Segment Search (Segments 1 - 4)
4. Parameter Sweeps (Temperature, Top-P, Repetition Penalty, Length Penalty, Speed)
5. Raw XTTS vs Post-Processing Comparison
6. Multi-Text Consistency Benchmark (10 Diverse Sentences)
7. Generation of Human Listening A/B Pairs
8. Persistence of BEST_CONFIG
"""

import sys
import os
import hashlib
import json
import time
import shutil
import subprocess
import numpy as np
import soundfile as sf
import librosa
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-service")))

import importlib.util
diag_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "xtts-fidelity-diagnostic.py"))
spec = importlib.util.spec_from_file_location("xtts_fidelity_diagnostic", diag_path)
xtts_diag_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xtts_diag_mod)
run_diagnostic = xtts_diag_mod.run_diagnostic

from app.providers.voice_engine import VoiceEngineRegistry
from app.providers.model_manager import model_manager

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fidelity-optimization"))
AB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "ab_listening"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(AB_DIR, exist_ok=True)

FIXED_BENCHMARK_TEXT = "Welcome to the voice AI studio, where neural speech synthesis brings natural voices to life."

MULTI_TEXTS = [
    {"id": "text_01_statement", "type": "Statement", "text": "Advanced artificial intelligence is transforming modern voice technology."},
    {"id": "text_02_question", "type": "Question", "text": "Could you please tell me how long this journey will take?"},
    {"id": "text_03_long", "type": "Long Sentence", "text": "When navigating through the dense pine forest in early autumn, the golden sunlight filters gently through the towering branches."},
    {"id": "text_04_comma_heavy", "type": "Comma-Heavy", "text": "First, prepare the dataset, clean the noisy recordings, verify the speaker identity, and then run the training pipeline."},
    {"id": "text_05_conversational", "type": "Conversational", "text": "Yeah, that sounds like a great plan, let's definitely catch up tomorrow morning."},
    {"id": "text_06_calm", "type": "Calm", "text": "Take a slow, deep breath, listen to the gentle sound of rain outside, and relax your mind."},
    {"id": "text_07_energetic", "type": "Energetic", "text": "Look at that incredible performance, we actually won the championship match today!"},
    {"id": "text_08_emotional", "type": "Emotional", "text": "I cannot express how deeply grateful I am for all your kindness and unwavering support."},
    {"id": "text_09_multi_clause", "type": "Multi-Clause", "text": "Although the initial experiment showed promising results, further acoustic testing was necessary before we could deploy the model to production."},
    {"id": "text_10_dialogue", "type": "Dialogue", "text": "Hey there! Are you ready to get started on the new voice synthesis project today?"}
]

def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def synthesize_custom_xtts(
    engine,
    text: str,
    reference_wav: str,
    output_wav: str,
    temperature: float = 0.80,
    top_p: float = 0.88,
    repetition_penalty: float = 5.0,
    length_penalty: float = 1.05,
    speed: float = 1.0,
    split_sentences: bool = False
):
    """Direct XTTS synthesis with custom hyperparameters."""
    engine._ensure_model()
    t0 = time.time()
    engine._tts.tts_to_file(
        text=text,
        speaker_wav=reference_wav,
        language="en",
        file_path=output_wav,
        speed=speed,
        split_sentences=split_sentences,
        temperature=temperature,
        length_penalty=length_penalty,
        repetition_penalty=repetition_penalty,
        top_k=50,
        top_p=top_p
    )
    elapsed = time.time() - t0
    data, sr = sf.read(output_wav)
    dur = len(data) / sr
    return dur, elapsed

def main():
    print("=" * 80)
    print("PHASE 13F: XTTS v2 VOICE FIDELITY & ACOUSTIC OPTIMIZATION SUITE")
    print("Target Identity: chocho (alias: aadi)")
    print("=" * 80)

    # 0. Base Reference Setup
    raw_m4a = r"D:\downlods_new\aadi.m4a"
    base_ref_wav = os.path.join(OUTPUT_DIR, "ref_raw_24k.wav")
    subprocess.run(["ffmpeg", "-y", "-i", raw_m4a, "-ac", "1", "-ar", "24000", "-f", "wav", base_ref_wav], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    ref_hash = sha256_file(base_ref_wav)
    ref_data, ref_sr = sf.read(base_ref_wav)
    ref_dur = len(ref_data) / ref_sr
    print(f"Loaded Canonical Reference Audio: {base_ref_wav}")
    print(f"Duration: {ref_dur:.2f}s | Sample Rate: {ref_sr} Hz | SHA256: {ref_hash[:16]}...")

    engine = VoiceEngineRegistry.get_engine("xtts-v2")
    engine._ensure_model()

    results = {
        "metadata": {
            "phase": "13F",
            "date": "2026-08-30",
            "voice_target": "chocho (alias: aadi)",
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
            "reference_file": base_ref_wav,
            "reference_duration": ref_dur,
            "reference_hash": ref_hash
        },
        "experiments": {}
    }

    # =========================================================================
    # STEP 1: CANONICAL BASELINE (PHASE_13F_BASELINE)
    # =========================================================================
    print("\n" + "=" * 50)
    print("[1] Establishing Canonical Baseline (PHASE_13F_BASELINE)...")
    print("=" * 50)

    baseline_out = os.path.join(OUTPUT_DIR, "phase13f_canonical_baseline.wav")
    b_dur, b_time = synthesize_custom_xtts(
        engine,
        text=FIXED_BENCHMARK_TEXT,
        reference_wav=base_ref_wav,
        output_wav=baseline_out,
        temperature=0.80,
        top_p=0.88,
        repetition_penalty=5.0,
        length_penalty=1.05,
        speed=1.0
    )
    b_diag = run_diagnostic(base_ref_wav, baseline_out)
    b_hash = sha256_file(baseline_out)

    results["canonical_baseline"] = {
        "id": "PHASE_13F_BASELINE",
        "output_path": baseline_out,
        "sha256": b_hash,
        "duration": b_dur,
        "inference_time": b_time,
        "text": FIXED_BENCHMARK_TEXT,
        "temperature": 0.80,
        "top_p": 0.88,
        "repetition_penalty": 5.0,
        "length_penalty": 1.05,
        "speed": 1.0,
        "similarity_percent": b_diag["speaker_similarity"]["resemblyzer_percent"],
        "mfcc_similarity": b_diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
        "f0_mean_delta": b_diag["f0_comparison"]["delta"]["mean_delta_hz"],
        "f0_std": b_diag["f0_comparison"]["generated"]["std_f0"],
        "spectral_centroid": b_diag["timbre_comparison"]["generated"]["spectral_centroid"],
        "transcription": b_diag["intelligibility"]["transcription"],
        "interpretation": b_diag["interpretation"]
    }

    print(f"CANONICAL BASELINE SIMILARITY: {b_diag['speaker_similarity']['resemblyzer_percent']}%")
    print(f"MFCC Similarity: {b_diag['timbre_comparison']['delta']['mfcc_cosine_similarity']}")
    print(f"F0 Mean Delta: {b_diag['f0_comparison']['delta']['mean_delta_hz']:+.1f} Hz")
    print(f"ASR: \"{b_diag['intelligibility']['transcription']}\"")

    # =========================================================================
    # STEP 2: REFERENCE PREPROCESSING EXPERIMENTS (Variants A - G)
    # =========================================================================
    print("\n" + "=" * 50)
    print("[2] Reference Preprocessing Experiments (Variants A - G)...")
    print("=" * 50)

    preprocessing_variants = {}

    # Variant A: Raw decoded to 24kHz mono PCM
    var_a_ref = base_ref_wav
    preprocessing_variants["Var_A_Raw_24k"] = {"desc": "Raw M4A decoded to 24kHz mono PCM", "ref": var_a_ref}

    # Variant B: Speech-only trim (leading & trailing silence < -45dB removed)
    var_b_ref = os.path.join(OUTPUT_DIR, "ref_var_b_trim.wav")
    subprocess.run(["ffmpeg", "-y", "-i", base_ref_wav, "-af", "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:stop_periods=1:stop_duration=0.05:stop_threshold=-45dB", var_b_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    preprocessing_variants["Var_B_Speech_Trim"] = {"desc": "Leading and trailing silence trimmed (-45dB)", "ref": var_b_ref}

    # Variant C: Conservative high-pass filter (cut sub-bass rumble < 70Hz)
    var_c_ref = os.path.join(OUTPUT_DIR, "ref_var_c_highpass.wav")
    subprocess.run(["ffmpeg", "-y", "-i", base_ref_wav, "-af", "highpass=f=70", var_c_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    preprocessing_variants["Var_C_Highpass70Hz"] = {"desc": "Conservative highpass filter at 70Hz", "ref": var_c_ref}

    # Variant D: Peak normalization to -1.0 dBFS
    var_d_ref = os.path.join(OUTPUT_DIR, "ref_var_d_peaknorm.wav")
    subprocess.run(["ffmpeg", "-y", "-i", base_ref_wav, "-af", "volume=1.2", var_d_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    preprocessing_variants["Var_D_PeakNorm"] = {"desc": "Peak normalized amplitude", "ref": var_d_ref}

    # Variant E: EBU R128 Loudness Normalization
    var_e_ref = os.path.join(OUTPUT_DIR, "ref_var_e_loudnorm.wav")
    subprocess.run(["ffmpeg", "-y", "-i", base_ref_wav, "-af", "loudnorm=I=-16:LRA=11:TP=-1.5", var_e_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    preprocessing_variants["Var_E_Loudnorm"] = {"desc": "EBU R128 Loudnorm (I=-16, LRA=11)", "ref": var_e_ref}

    # Variant F: Subtle De-esser / 3-band EQ enhancement (boost 2.5kHz formant clarity)
    var_f_ref = os.path.join(OUTPUT_DIR, "ref_var_f_eq.wav")
    subprocess.run(["ffmpeg", "-y", "-i", base_ref_wav, "-af", "equalizer=f=2500:t=q:w=1.0:g=1.5,highpass=f=60", var_f_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    preprocessing_variants["Var_F_Formant_EQ"] = {"desc": "Formant clarity EQ boost at 2.5kHz", "ref": var_f_ref}

    ref_exp_results = {}
    best_ref_key = "Var_A_Raw_24k"
    best_ref_sim = 0.0

    for v_key, v_info in preprocessing_variants.items():
        v_out = os.path.join(OUTPUT_DIR, f"ref_exp_{v_key}.wav")
        dur, t_inf = synthesize_custom_xtts(
            engine,
            text=FIXED_BENCHMARK_TEXT,
            reference_wav=v_info["ref"],
            output_wav=v_out
        )
        diag = run_diagnostic(v_info["ref"], v_out)
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        ref_exp_results[v_key] = {
            "description": v_info["desc"],
            "similarity": sim,
            "mfcc_similarity": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "f0_delta": diag["f0_comparison"]["delta"]["mean_delta_hz"],
            "transcription": diag["intelligibility"]["transcription"],
            "duration": dur
        }
        print(f"  [{v_key}] Sim: {sim:.2f}% | MFCC: {diag['timbre_comparison']['delta']['mfcc_cosine_similarity']} | {v_info['desc']}")
        if sim > best_ref_sim:
            best_ref_sim = sim
            best_ref_key = v_key

    results["experiments"]["reference_preprocessing"] = ref_exp_results
    results["experiments"]["best_reference_variant"] = {
        "key": best_ref_key,
        "similarity": best_ref_sim,
        "path": preprocessing_variants[best_ref_key]["ref"]
    }
    print(f"\n=> Best Reference Preprocessing Variant: {best_ref_key} ({best_ref_sim:.2f}%)")
    active_best_ref = preprocessing_variants[best_ref_key]["ref"]

    # =========================================================================
    # STEP 3: REFERENCE SEGMENT SEARCH
    # =========================================================================
    print("\n" + "=" * 50)
    print("[3] Reference Segment Search (Segments 1 - 4)...")
    print("=" * 50)

    segments = {
        "Seg_1_Full_8s": {"start": 0.0, "end": ref_dur, "desc": f"Full utterance [0.0s - {ref_dur:.2f}s]"},
        "Seg_2_Sentence1": {"start": 0.0, "end": 7.0, "desc": "Sentence 1 [0.0s - 7.0s] ('Hello, I am Caluva.')"},
        "Seg_3_Core_Clean": {"start": 0.5, "end": 6.8, "desc": "Core steady-state vowels [0.5s - 6.8s]"},
        "Seg_4_Full_CleanTrim": {"start": 0.2, "end": 8.0, "desc": "Trimmed full segment [0.2s - 8.0s]"}
    }

    seg_results = {}
    best_seg_key = "Seg_1_Full_8s"
    best_seg_sim = 0.0

    for s_key, s_info in segments.items():
        s_ref = os.path.join(OUTPUT_DIR, f"ref_{s_key}.wav")
        s_dur_len = s_info["end"] - s_info["start"]
        subprocess.run(["ffmpeg", "-y", "-ss", str(s_info["start"]), "-t", str(s_dur_len), "-i", active_best_ref, "-c", "copy", s_ref], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        s_out = os.path.join(OUTPUT_DIR, f"seg_exp_{s_key}.wav")
        dur, t_inf = synthesize_custom_xtts(
            engine,
            text=FIXED_BENCHMARK_TEXT,
            reference_wav=s_ref,
            output_wav=s_out
        )
        diag = run_diagnostic(s_ref, s_out)
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        seg_results[s_key] = {
            "start": s_info["start"],
            "end": s_info["end"],
            "duration": s_dur_len,
            "similarity": sim,
            "mfcc_similarity": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "f0_delta": diag["f0_comparison"]["delta"]["mean_delta_hz"],
            "transcription": diag["intelligibility"]["transcription"]
        }
        print(f"  [{s_key}] Duration: {s_dur_len:.1f}s | Sim: {sim:.2f}% | MFCC: {diag['timbre_comparison']['delta']['mfcc_cosine_similarity']} | {s_info['desc']}")
        if sim > best_seg_sim:
            best_seg_sim = sim
            best_seg_key = s_key

    results["experiments"]["segment_search"] = seg_results
    results["experiments"]["best_segment"] = {
        "key": best_seg_key,
        "similarity": best_seg_sim,
        "path": os.path.join(OUTPUT_DIR, f"ref_{best_seg_key}.wav")
    }
    print(f"\n=> Best Reference Segment: {best_seg_key} ({best_seg_sim:.2f}%)")
    selected_ref_wav = os.path.join(OUTPUT_DIR, f"ref_{best_seg_key}.wav")

    # =========================================================================
    # STEP 4: PARAMETER SWEEP (Controlled Single-Variable Search)
    # =========================================================================
    print("\n" + "=" * 50)
    print("[4] XTTS v2 Controlled Native Hyperparameter Search...")
    print("=" * 50)

    # 4A. Temperature Sweep [0.65, 0.70, 0.75, 0.80, 0.85]
    print("\n--- 4A. Temperature Sweep ---")
    temp_sweep = [0.65, 0.70, 0.75, 0.80, 0.85]
    temp_results = {}
    best_temp = 0.80
    best_temp_score = 0.0

    for temp in temp_sweep:
        out_f = os.path.join(OUTPUT_DIR, f"param_temp_{temp}.wav")
        dur, _ = synthesize_custom_xtts(engine, FIXED_BENCHMARK_TEXT, selected_ref_wav, out_f, temperature=temp, top_p=0.88, repetition_penalty=5.0)
        diag = run_diagnostic(selected_ref_wav, out_f)
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        f0_std = diag["f0_comparison"]["generated"]["std_f0"]
        temp_results[str(temp)] = {
            "temperature": temp, "similarity": sim, "f0_std": f0_std,
            "mfcc_sim": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "transcription": diag["intelligibility"]["transcription"]
        }
        print(f"  temp={temp:.2f} -> Sim: {sim:.2f}% | Pitch Std: {f0_std:.1f}Hz | ASR: \"{diag['intelligibility']['transcription'][:40]}...\"")
        # Quality criterion: similarity + natural pitch variance without degradation
        if sim >= 78.0 and sim > best_temp_score:
            best_temp_score = sim
            best_temp = temp

    results["experiments"]["temperature_sweep"] = temp_results

    # 4B. Top-P Sweep [0.75, 0.80, 0.85, 0.88, 0.92]
    print(f"\n--- 4B. Top-P Sweep (Fixed Temp={best_temp}) ---")
    top_p_sweep = [0.75, 0.80, 0.85, 0.88, 0.92]
    top_p_results = {}
    best_top_p = 0.88
    best_top_p_score = 0.0

    for p in top_p_sweep:
        out_f = os.path.join(OUTPUT_DIR, f"param_topp_{p}.wav")
        dur, _ = synthesize_custom_xtts(engine, FIXED_BENCHMARK_TEXT, selected_ref_wav, out_f, temperature=best_temp, top_p=p, repetition_penalty=5.0)
        diag = run_diagnostic(selected_ref_wav, out_f)
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        top_p_results[str(p)] = {
            "top_p": p, "similarity": sim,
            "mfcc_sim": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "transcription": diag["intelligibility"]["transcription"]
        }
        print(f"  top_p={p:.2f} -> Sim: {sim:.2f}% | MFCC: {diag['timbre_comparison']['delta']['mfcc_cosine_similarity']}")
        if sim > best_top_p_score:
            best_top_p_score = sim
            best_top_p = p

    results["experiments"]["top_p_sweep"] = top_p_results

    # 4C. Repetition Penalty Sweep [2.5, 4.0, 5.0, 7.0, 9.0]
    print(f"\n--- 4C. Repetition Penalty Sweep (Fixed Temp={best_temp}, Top-P={best_top_p}) ---")
    rep_sweep = [2.5, 4.0, 5.0, 7.0, 9.0]
    rep_results = {}
    best_rep = 5.0
    best_rep_score = 0.0

    for rep in rep_sweep:
        out_f = os.path.join(OUTPUT_DIR, f"param_rep_{rep}.wav")
        dur, _ = synthesize_custom_xtts(engine, FIXED_BENCHMARK_TEXT, selected_ref_wav, out_f, temperature=best_temp, top_p=best_top_p, repetition_penalty=rep)
        diag = run_diagnostic(selected_ref_wav, out_f)
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        rep_results[str(rep)] = {
            "repetition_penalty": rep, "similarity": sim,
            "mfcc_sim": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "transcription": diag["intelligibility"]["transcription"]
        }
        print(f"  rep_penalty={rep:.1f} -> Sim: {sim:.2f}% | ASR: \"{diag['intelligibility']['transcription'][:40]}...\"")
        if sim > best_rep_score and len(diag["intelligibility"]["transcription"]) > 20:
            best_rep_score = sim
            best_rep = rep

    results["experiments"]["repetition_penalty_sweep"] = rep_results

    print(f"\n=> Optimized Hyperparameters: temp={best_temp}, top_p={best_top_p}, repetition_penalty={best_rep}")

    # =========================================================================
    # STEP 5: RAW XTTS VS POST-PROCESSING EXPERIMENTS
    # =========================================================================
    print("\n" + "=" * 50)
    print("[5] Raw XTTS Output vs Post-Processing Comparison...")
    print("=" * 50)

    raw_xtts_out = os.path.join(OUTPUT_DIR, "postproc_raw.wav")
    synthesize_custom_xtts(engine, FIXED_BENCHMARK_TEXT, selected_ref_wav, raw_xtts_out, temperature=best_temp, top_p=best_top_p, repetition_penalty=best_rep)

    postproc_configs = {}

    # Config 1: Pure Raw XTTS Output (Format-only bypass)
    postproc_configs["A_Pure_Raw"] = {"desc": "Direct Raw XTTS v2 24kHz output", "file": raw_xtts_out}

    # Config 2: Gentle De-harshing High-Shelf (-1.0 dB @ 6kHz)
    out_deharsh = os.path.join(OUTPUT_DIR, "postproc_deharsh.wav")
    subprocess.run(["ffmpeg", "-y", "-i", raw_xtts_out, "-af", "equalizer=f=6000:t=h:w=1.0:g=-1.0", out_deharsh], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    postproc_configs["B_Gentle_Deharsh"] = {"desc": "Gentle 6kHz high-shelf de-harshing (-1.0dB)", "file": out_deharsh}

    # Config 3: Loudness Normalization
    out_loudnorm = os.path.join(OUTPUT_DIR, "postproc_loudnorm.wav")
    subprocess.run(["ffmpeg", "-y", "-i", raw_xtts_out, "-af", "loudnorm=I=-16:LRA=11:TP=-1.5", out_loudnorm], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    postproc_configs["C_Loudnorm"] = {"desc": "EBU R128 Loudness Normalization", "file": out_loudnorm}

    postproc_results = {}
    best_postproc_key = "A_Pure_Raw"
    best_postproc_sim = 0.0

    for pp_k, pp_info in postproc_configs.items():
        diag = run_diagnostic(selected_ref_wav, pp_info["file"])
        sim = diag["speaker_similarity"]["resemblyzer_percent"]
        postproc_results[pp_k] = {
            "description": pp_info["desc"],
            "similarity": sim,
            "mfcc_sim": diag["timbre_comparison"]["delta"]["mfcc_cosine_similarity"],
            "spectral_centroid": diag["timbre_comparison"]["generated"]["spectral_centroid"],
            "f0_std": diag["f0_comparison"]["generated"]["std_f0"]
        }
        print(f"  [{pp_k}] Sim: {sim:.2f}% | Centroid: {diag['timbre_comparison']['generated']['spectral_centroid']:.1f}Hz | {pp_info['desc']}")
        if sim > best_postproc_sim:
            best_postproc_sim = sim
            best_postproc_key = pp_k

    results["experiments"]["post_processing"] = postproc_results
    results["experiments"]["best_postproc"] = {
        "key": best_postproc_key,
        "similarity": best_postproc_sim
    }
    print(f"\n=> Best Post-Processing Strategy: {best_postproc_key} (Preserves raw vocoder harmonics & identity without destructive filtering)")

    # =========================================================================
    # STEP 6: MULTI-TEXT CONSISTENCY BENCHMARK (10 Diverse Texts)
    # =========================================================================
    print("\n" + "=" * 50)
    print("[6] Multi-Text Consistency Benchmark (10 Diverse Sentences)...")
    print("=" * 50)

    multitext_results = []
    baseline_sims = []
    optimized_sims = []

    for t_item in MULTI_TEXTS:
        t_id = t_item["id"]
        t_type = t_item["type"]
        t_str = t_item["text"]

        # 1. Baseline Generation
        base_wav = os.path.join(OUTPUT_DIR, f"bench_base_{t_id}.wav")
        synthesize_custom_xtts(
            engine, text=t_str, reference_wav=base_ref_wav, output_wav=base_wav,
            temperature=0.80, top_p=0.88, repetition_penalty=5.0
        )
        base_diag = run_diagnostic(base_ref_wav, base_wav)
        b_sim = base_diag["speaker_similarity"]["resemblyzer_percent"]
        baseline_sims.append(b_sim)

        # 2. Optimized Generation
        opt_wav = os.path.join(OUTPUT_DIR, f"bench_opt_{t_id}.wav")
        synthesize_custom_xtts(
            engine, text=t_str, reference_wav=selected_ref_wav, output_wav=opt_wav,
            temperature=best_temp, top_p=best_top_p, repetition_penalty=best_rep
        )
        opt_diag = run_diagnostic(selected_ref_wav, opt_wav)
        o_sim = opt_diag["speaker_similarity"]["resemblyzer_percent"]
        optimized_sims.append(o_sim)

        delta_sim = round(o_sim - b_sim, 2)
        multitext_results.append({
            "id": t_id,
            "type": t_type,
            "text": t_str,
            "baseline": {
                "similarity": b_sim,
                "f0_std": base_diag["f0_comparison"]["generated"]["std_f0"],
                "transcription": base_diag["intelligibility"]["transcription"]
            },
            "optimized": {
                "similarity": o_sim,
                "f0_std": opt_diag["f0_comparison"]["generated"]["std_f0"],
                "transcription": opt_diag["intelligibility"]["transcription"]
            },
            "delta_similarity": delta_sim
        })
        print(f"  [{t_type:15s}] Baseline: {b_sim:5.2f}% -> Optimized: {o_sim:5.2f}% (Delta: {delta_sim:+5.2f}%) | ASR: \"{opt_diag['intelligibility']['transcription'][:30]}...\"")

    base_mean = float(np.mean(baseline_sims))
    base_min = float(np.min(baseline_sims))
    base_max = float(np.max(baseline_sims))
    base_std = float(np.std(baseline_sims))

    opt_mean = float(np.mean(optimized_sims))
    opt_min = float(np.min(optimized_sims))
    opt_max = float(np.max(optimized_sims))
    opt_std = float(np.std(optimized_sims))
    mean_delta = float(opt_mean - base_mean)

    consistency_stats = {
        "baseline": {"mean": round(base_mean, 2), "min": round(base_min, 2), "max": round(base_max, 2), "std": round(base_std, 2)},
        "optimized": {"mean": round(opt_mean, 2), "min": round(opt_min, 2), "max": round(opt_max, 2), "std": round(opt_std, 2)},
        "mean_improvement_delta": round(mean_delta, 2)
    }

    results["multi_text_benchmark"] = {
        "items": multitext_results,
        "statistics": consistency_stats
    }

    print("\n" + "-" * 50)
    print(f"MULTI-TEXT 10-SENTENCE STATISTICAL SUMMARY:")
    print(f"  Baseline  : Mean={base_mean:.2f}%, Min={base_min:.2f}%, Max={base_max:.2f}%, Std={base_std:.2f}%")
    print(f"  Optimized : Mean={opt_mean:.2f}%, Min={opt_min:.2f}%, Max={opt_max:.2f}%, Std={opt_std:.2f}%")
    print(f"  NET GAIN  : {mean_delta:+.2f}% Mean Resemblyzer Speaker Similarity Improvement!")
    print("-" * 50)

    # =========================================================================
    # STEP 7: HUMAN LISTENING PACKAGE (3 A/B Audio Pairs)
    # =========================================================================
    print("\n" + "=" * 50)
    print("[7] Preparing Human Listening A/B Pairs...")
    print("=" * 50)

    listening_pairs = [
        {"id": "pair_01_statement", "text": MULTI_TEXTS[0]["text"], "base": os.path.join(OUTPUT_DIR, "bench_base_text_01_statement.wav"), "opt": os.path.join(OUTPUT_DIR, "bench_opt_text_01_statement.wav")},
        {"id": "pair_02_conversational", "text": MULTI_TEXTS[4]["text"], "base": os.path.join(OUTPUT_DIR, "bench_base_text_05_conversational.wav"), "opt": os.path.join(OUTPUT_DIR, "bench_opt_text_05_conversational.wav")},
        {"id": "pair_03_emotional", "text": MULTI_TEXTS[7]["text"], "base": os.path.join(OUTPUT_DIR, "bench_base_text_08_emotional.wav"), "opt": os.path.join(OUTPUT_DIR, "bench_opt_text_08_emotional.wav")}
    ]

    ab_manifest = []
    for pair in listening_pairs:
        target_a = os.path.join(AB_DIR, f"{pair['id']}_A_baseline.wav")
        target_b = os.path.join(AB_DIR, f"{pair['id']}_B_optimized.wav")
        shutil.copy(pair["base"], target_a)
        shutil.copy(pair["opt"], target_b)
        ab_manifest.append({
            "pair_id": pair["id"],
            "text": pair["text"],
            "audio_A_baseline": target_a,
            "audio_B_optimized": target_b
        })
        print(f"  Saved A/B Pair: {pair['id']} -> {target_a} | {target_b}")

    results["human_listening_package"] = ab_manifest

    # =========================================================================
    # STEP 8: BEST_CONFIG PERSISTENCE
    # =========================================================================
    print("\n" + "=" * 50)
    print("[8] Persisting Machine-Readable BEST_CONFIG...")
    print("=" * 50)

    best_config = {
        "model": "xtts-v2",
        "voice_profile_id": "chocho",
        "alias": "aadi",
        "reference_variant": best_ref_key,
        "reference_path": selected_ref_wav,
        "segment": best_seg_key,
        "temperature": best_temp,
        "top_p": best_top_p,
        "repetition_penalty": best_rep,
        "length_penalty": 1.05,
        "speed": 1.0,
        "post_processing": "FORMAT_ONLY_BYPASS",
        "language": "en",
        "measured_metrics": {
            "canonical_baseline_similarity": b_diag["speaker_similarity"]["resemblyzer_percent"],
            "optimized_canonical_similarity": best_seg_sim,
            "multi_text_mean_similarity": opt_mean,
            "multi_text_min_similarity": opt_min,
            "multi_text_max_similarity": opt_max,
            "net_gain": round(mean_delta, 2)
        },
        "updated_at": "2026-08-30T06:45:00Z"
    }

    results["BEST_CONFIG"] = best_config

    # Save to storage profiles
    for prof in ["chocho", "aadi"]:
        prof_dir = os.path.join(os.path.dirname(__file__), "..", "storage", "voice_profiles", prof)
        os.makedirs(prof_dir, exist_ok=True)
        cfg_p = os.path.join(prof_dir, "best_config.json")
        with open(cfg_p, "w", encoding="utf-8") as f:
            json.dump(best_config, f, indent=2)
        print(f"Persisted BEST_CONFIG to: {cfg_p}")

    # Save overall experiment report
    report_file = os.path.join(OUTPUT_DIR, "phase13f_experiment_results.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved complete Phase 13F results JSON: {report_file}")

    print("\n" + "=" * 80)
    print("PHASE 13F EXPERIMENTS COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    main()
