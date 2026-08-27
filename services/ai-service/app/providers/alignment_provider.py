"""
Transcript-Speaker Alignment Algorithm
Aligns fine-grained STT timestamps with Diarization speaker intervals
"""
from typing import List
from app.contracts.speech import STTSegment, SpeakerSegment, SpeakerAttributedSegment


class TranscriptSpeakerAligner:
    """
    Computes maximum temporal overlap between STT segments and Diarization intervals
    to produce clean speaker-attributed transcript structures.
    """
    @staticmethod
    def align(
        stt_segments: List[STTSegment],
        diarization_segments: List[SpeakerSegment]
    ) -> List[SpeakerAttributedSegment]:
        attributed: List[SpeakerAttributedSegment] = []

        for stt in stt_segments:
            best_speaker = "speaker_1"
            best_overlap = -1.0

            for d in diarization_segments:
                # Compute temporal intersection
                overlap_start = max(stt.start_time, d.start_time)
                overlap_end = min(stt.end_time, d.end_time)
                overlap = max(0.0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = d.speaker_id

            attributed.append(SpeakerAttributedSegment(
                speaker_id=best_speaker,
                start_time=stt.start_time,
                end_time=stt.end_time,
                text=stt.text,
                confidence=stt.confidence
            ))

        return attributed
