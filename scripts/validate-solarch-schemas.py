#!/usr/bin/env python3
"""
Lightweight Solarch / PocketBase Schema Validator

Verifies that:
1. Every collection in _collections parses cleanly.
2. Every field in each collection has a valid id, name, and type.
3. No collection contains duplicate field names.
4. voice_profiles has exactly 12 canonical fields, with referenceAudio appearing exactly once.
5. generation_jobs has exactly 12 canonical fields.
"""

import sys
import os
import sqlite3
import json

def validate_schemas(db_path="pb_data/data.db"):
    if not os.path.exists(db_path):
        print(f"ERROR: Database file not found at '{db_path}'")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, data FROM _collections")
    collections = cursor.fetchall()
    conn.close()

    total_collections = len(collections)
    errors = []

    print("================================================================")
    print(f"SOLARCH SCHEMA VALIDATION: {total_collections} COLLECTIONS INSPECTED")
    print("================================================================")

    for col_id, col_name, data_raw in collections:
        try:
            col_data = json.loads(data_raw)
        except Exception as e:
            errors.append(f"[{col_name}] JSON parse error: {e}")
            continue

        fields = col_data.get("fields", [])
        field_names = []

        # Validate each field structure
        for idx, f in enumerate(fields):
            if not isinstance(f, dict):
                errors.append(f"[{col_name}] Field index {idx} is not a valid object: {f}")
                continue

            f_id = f.get("id")
            f_name = f.get("name")
            f_type = f.get("type")

            if not f_id:
                errors.append(f"[{col_name}] Field index {idx} ({f_name}) is missing required 'id'")
            if not f_name:
                errors.append(f"[{col_name}] Field index {idx} is missing required 'name'")
            if not f_type:
                errors.append(f"[{col_name}] Field '{f_name}' is missing required 'type'")

            if f_name:
                field_names.append(f_name)

        # Check duplicate field names
        seen = set()
        duplicates = set()
        for name in field_names:
            if name in seen:
                duplicates.add(name)
            seen.add(name)

        if duplicates:
            errors.append(f"[{col_name}] Duplicate field names detected: {duplicates}")

        # Specific check for voice_profiles
        if col_name == "voice_profiles":
            ref_audio_count = field_names.count("referenceAudio")
            if ref_audio_count != 1:
                errors.append(f"[voice_profiles] Expected exactly 1 'referenceAudio' field, found {ref_audio_count}")

            expected_vp_fields = [
                "projectId", "userId", "name", "speakerId", "sourceAssetId",
                "speakerEmbedding", "timbreCharacteristics", "pitchStats",
                "prosodyProfile", "styleProfile", "emotionProfile", "referenceAudio"
            ]
            if len(field_names) != 12:
                errors.append(f"[voice_profiles] Expected 12 fields, found {len(field_names)}: {field_names}")

        # Specific check for generation_jobs
        if col_name == "generation_jobs":
            expected_gj_fields = [
                "projectId", "userId", "voiceProfileId", "text", "targetLanguage",
                "styleParams", "emotionParam", "status", "progress", "outputAssetId",
                "error", "executionTimeMs"
            ]
            if len(field_names) != 12:
                errors.append(f"[generation_jobs] Expected 12 fields, found {len(field_names)}: {field_names}")

        status = "FAIL" if any(col_name in err for err in errors) else "PASS"
        print(f"[{status}] {col_name:<20} ({col_id}) -> {len(fields)} valid fields")

    print("================================================================")
    if errors:
        print(f"VALIDATION FAILED WITH {len(errors)} ERROR(S):")
        for err in errors:
            print(f"  - {err}")
        return False
    else:
        print("ALL SCHEMAS ARE CLEAN, CANONICAL, AND VALID!")
        return True

if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "pb_data/data.db"
    success = validate_schemas(db)
    sys.exit(0 if success else 1)
