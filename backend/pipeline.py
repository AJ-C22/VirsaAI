"""
Oral-story processing pipeline for the VirsaAI API.

Encapsulates Whisper transcription + Gemini biography/extraction,
and drives processing-job stage updates for uploaded or paste-in stories.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import whisper
from dotenv import load_dotenv
from google import genai

from db.db_operations import (
    finalize_story_processing,
    mark_story_failed,
    update_processing_job,
)
from family_extract import (
    family_extract_prompt,
    parse_json_response,
    sanitize_family_members,
)

_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent


def _load_gemini_key() -> str | None:
    """Load GEMINI_KEY from project root .env, then backend .env (backend wins)."""
    load_dotenv(_PROJECT_ROOT / ".env")
    load_dotenv(_BACKEND_DIR / ".env")
    return os.getenv("GEMINI_KEY")


def transcribe_audio(audio_file, model_size: str = "base"):
    print(f"Transcribing audio with Whisper '{model_size}'...")
    model = whisper.load_model(model_size, device="cpu")
    result = model.transcribe(audio_file, task="translate")
    print("Transcription complete.")
    return result["text"]


def parse_text_gemini(transcript, api_key):
    print("\nOrganizing text with AI...\n")
    client = genai.Client(api_key=api_key)

    prompt = f"""
        You are VirsaAI — a thoughtful archivist that organizes real spoken life stories
        into clear, readable sections that reflect the person’s journey.

        ### Your task:

        ### Your ONLY output:
        A **single organized biography** with section headers that . 
        DO NOT repeat, rewrite, or include the transcript in raw form.
        DO NOT output anything before or after the biography.
        DO NOT include 'HISTORICAL STORY:', 'Transcript:', or any headings I did not request.

        Organize the following transcript into a structured family biography written in a warm but factual tone. 
        Focus on clarity, chronological flow, and emotional truth.Use section headers like ‘Early Life in Punjab,’ 
        ‘Migration to Canada,’ and ‘Family & Legacy.’ Add historical or cultural context where relevant (e.g., local traditions, 
        global events, immigration era). Preserve personal quotes or expressions exactly as spoken. Include small reflections that 
        connect past and present generations. Avoid exaggeration — keep it natural and documentary-style, suitable for a family 
        history archive.

        ### Instructions:
        1. Identify logical story sections — for example: "Childhood Memories", "Moving Abroad",
        "Raising a Family", "Faith and Community", "Reflections", etc.
        Choose headings that best describe the actual content.

        2. Summarize what was said in each section in clear English paragraphs.
        - Keep it personal and emotional where appropriate.
        - Preserve cultural details, names, and places.
        - Merge overlapping or repeated ideas into one coherent section.

        3. Maintain chronological flow — from earliest memories to later reflections.


        ### Transcript:
        {transcript}
        """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    organized_story = response.text.strip()

    print("\nHISTORICAL STORY:\n")
    print(organized_story)

    return organized_story


def extract_key_data(transcript, api_key):
    print("\nExtracting JSON...\n")
    client = genai.Client(api_key=api_key)

    prompt = f"""
        You are an information extraction system for life story archiving.

        Your job is to convert a raw life story transcript into a structured JSON object optimized for:
        - Timeline visualization (chronological events with dates)
        - Data storage and retrieval (key facts and metadata)

        CRITICAL RULES:
        - DO NOT add anything that is not stated or logically implied in the transcript
        - If dates are missing, infer approximate years from context clues (e.g., "when I was 12", "in the 1960s")
        - Use null for unknown dates/years, not guesses
        - Keep all text concise and factual
        - All output MUST be valid JSON only (no markdown, no explanations)
        - Do NOT extract family_members here (handled in a separate strict pass)

        Extract the following structured data:

        1. "summary": A 2–3 sentence summary of the life story.

        2. "person_info": Basic information about the main person (the storyteller):
           {{
             "birth_year": Integer or null,
             "birth_place": String or null,
             "death_year": Integer or null (if mentioned),
             "name": String or null (if mentioned in third person)
           }}

        3. "timeline_events": Chronological list of ONLY the most significant and note-worthy events that would be seen in a timeline.
           
           INCLUDE events like:
           - Major life transitions (birth, immigration, marriage, death)
           - Significant achievements (graduation, career milestones, awards)
           - Important family events (birth of children, family reunions, losses)
           - Major moves or relocations
           - Historical or cultural milestones that affected the person
           
           EXCLUDE routine or minor events like:
           - Daily activities, regular work days, casual conversations
           - Minor trips or visits unless they were life-changing
           - Routine celebrations or holidays (unless specifically significant)
           - Vague memories without clear dates or importance
           
           Each event includes:
           {{
             "year": Integer or null,
             "event": String (concise title/summary of event),
             "description": String (longer description with more context),
             "location": String or null (where it happened),
             "category": String (e.g., "birth", "immigration", "marriage", "education", "career", "family", "milestone")
           }}

        4. "family_members": []  (always empty — family tree is extracted separately)

        5. "locations": Places where the person lived or spent significant time.
           Each location includes:
           {{
             "place": String (city, region, or country),
             "start_year": Integer or null,
             "end_year": Integer or null,
             "purpose": String or null (e.g., "birthplace", "childhood home", "immigration destination", "work")
           }}

        6. "occupations": Career or work history (if mentioned).
           Each occupation includes:
           {{
             "role": String (job title or occupation),
             "start_year": Integer or null,
             "end_year": Integer or null,
             "location": String or null (where they worked)
           }}

        7. "themes": Key themes or topics (for searchability).
           Array of strings (e.g., ["immigration", "family", "education", "resilience", "faith", "community"])

        OUTPUT REQUIREMENTS:
        - Return ONLY valid JSON (no markdown, no code blocks, no explanations)
        - Use null for missing/unknown values
        - Use empty arrays [] if a section has no data
        - Include all fields described above in the JSON structure

        Here is the raw life story transcript:
        {transcript}
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    print("\nJSON:\n")
    print(response.text)

    extracted_data = parse_json_response(response.text)
    if not extracted_data:
        print(f"\nError parsing JSON. Raw response: {response.text}")
        return None
    return extracted_data


def extract_family_tree(
    transcript: str,
    api_key: str,
    storyteller_name: str | None = None,
) -> list:
    """Focused Gemini pass for pedigree-safe family members."""
    print("\nExtracting family tree (strict)…\n")
    client = genai.Client(api_key=api_key)
    prompt = family_extract_prompt(transcript, storyteller_name)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    print("\nFAMILY JSON:\n")
    print(response.text)
    data = parse_json_response(response.text) or {}
    members = data.get("family_members") or []
    sanitized = sanitize_family_members(members, transcript, storyteller_name)
    print("\nFAMILY SANITIZED:\n")
    print(json.dumps(sanitized, indent=2))
    return sanitized


def _fail_job(story_id: str, job_id: str, error: str) -> None:
    print(f"[pipeline] FAILED story={story_id} job={job_id}: {error}")
    update_processing_job(job_id, stage="failed", progress=1.0, error=error)
    mark_story_failed(story_id, error)


def _run_post_transcript(
    story_id: str,
    job_id: str,
    transcript: str,
    api_key: str,
    person_name_hint: str | None,
    auto_confirm: bool,
) -> None:
    print(f"[pipeline] writing biography for story={story_id}")
    update_processing_job(job_id, stage="writing", progress=0.45)
    biography = parse_text_gemini(transcript, api_key)

    print(f"[pipeline] extracting structured data for story={story_id}")
    update_processing_job(job_id, stage="extracting", progress=0.65)
    extracted_data = extract_key_data(transcript, api_key)
    if not extracted_data:
        raise RuntimeError("Failed to extract structured data from transcript")

    # Dedicated family pass — never trust the general extract for tree edges
    update_processing_job(job_id, stage="extracting", progress=0.78)
    storyteller = (
        person_name_hint
        or (extracted_data.get("person_info") or {}).get("name")
        or None
    )
    try:
        family = extract_family_tree(transcript, api_key, storyteller)
    except Exception as fe:
        print(f"[pipeline] family extract failed, leaving unattached: {fe}")
        family = []
    extracted_data["family_members"] = family

    summary = extracted_data.get("summary")

    print(f"[pipeline] saving results for story={story_id}")
    update_processing_job(job_id, stage="saving", progress=0.9)
    ok = finalize_story_processing(
        story_id=story_id,
        transcript=transcript,
        biography=biography,
        summary=summary,
        extracted_data=extracted_data,
        person_name_hint=person_name_hint,
        auto_confirm=auto_confirm,
    )
    if not ok:
        raise RuntimeError("finalize_story_processing failed")

    update_processing_job(job_id, stage="completed", progress=1.0)
    print(f"[pipeline] completed story={story_id} job={job_id}")


def process_uploaded_story(
    story_id: str,
    job_id: str,
    audio_path: str,
    person_name_hint: str | None = None,
    auto_confirm: bool = True,
) -> None:
    """Full pipeline: Whisper → Gemini biography → extract → finalize."""
    print(f"[pipeline] queued story={story_id} job={job_id} audio={audio_path}")
    update_processing_job(job_id, stage="queued", progress=0.0)

    try:
        api_key = _load_gemini_key()
        if not api_key:
            raise RuntimeError("GEMINI_KEY is not set")

        print(f"[pipeline] transcribing story={story_id}")
        update_processing_job(job_id, stage="transcribing", progress=0.1)
        transcript = transcribe_audio(audio_path, model_size="base")
        if not transcript or not str(transcript).strip():
            raise RuntimeError("Transcription produced empty text")

        _run_post_transcript(
            story_id=story_id,
            job_id=job_id,
            transcript=transcript,
            api_key=api_key,
            person_name_hint=person_name_hint,
            auto_confirm=auto_confirm,
        )
    except Exception as e:
        _fail_job(story_id, job_id, str(e))


def process_transcript_story(
    story_id: str,
    job_id: str,
    transcript: str,
    person_name_hint: str | None = None,
    auto_confirm: bool = True,
) -> None:
    """Skip Whisper — run Gemini biography + extract from an existing transcript."""
    print(f"[pipeline] queued (transcript) story={story_id} job={job_id}")
    update_processing_job(job_id, stage="queued", progress=0.0)

    try:
        api_key = _load_gemini_key()
        if not api_key:
            raise RuntimeError("GEMINI_KEY is not set")

        if not transcript or not str(transcript).strip():
            raise RuntimeError("Transcript is empty")

        # Skip Whisper; shared path starts at writing (0.45)
        _run_post_transcript(
            story_id=story_id,
            job_id=job_id,
            transcript=transcript,
            api_key=api_key,
            person_name_hint=person_name_hint,
            auto_confirm=auto_confirm,
        )
    except Exception as e:
        _fail_job(story_id, job_id, str(e))
