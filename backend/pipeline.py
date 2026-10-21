"""
Oral-story processing pipeline for the VirsaAI API.

Encapsulates Whisper transcription + Gemini biography/extraction,
and drives processing-job stage updates for uploaded or paste-in stories.
"""
from __future__ import annotations

import json
import os
import re
import threading
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


_WHISPER_MODELS: dict = {}
_FASTER_MODELS: dict = {}
_WHISPER_LOCK = threading.Lock()
_WHISPER_PROMPT = (
    "Family oral history. The speaker may mix Punjabi, Hindi, Urdu, and English. "
    "Keep every personal name exactly as spoken. Do not translate."
)


def _whisper_size(model_size: str | None) -> str:
    return (model_size or os.getenv("WHISPER_MODEL") or "small").strip()


def _use_faster_whisper() -> bool:
    """int8 faster-whisper is the accurate path that stays fast on CPU."""
    if os.getenv("WHISPER_ENGINE", "faster").strip().lower() == "openai":
        return False
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def _openai_whisper_model(model_size: str):
    with _WHISPER_LOCK:
        model = _WHISPER_MODELS.get(model_size)
        if model is None:
            print(f"Loading Whisper '{model_size}' (once per process)...")
            model = whisper.load_model(model_size, device="cpu")
            _WHISPER_MODELS[model_size] = model
        return model


def _faster_whisper_model(model_size: str):
    from faster_whisper import WhisperModel

    with _WHISPER_LOCK:
        model = _FASTER_MODELS.get(model_size)
        if model is None:
            print(f"Loading faster-whisper '{model_size}' int8 (once per process)...")
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            _FASTER_MODELS[model_size] = model
        return model


def _transcribe_faster(audio_file, model_size: str) -> dict:
    model = _faster_whisper_model(model_size)
    # Beam search keeps names; VAD skips silence; one temperature avoids re-decodes.
    segments, info = model.transcribe(
        audio_file,
        task="transcribe",
        beam_size=5,
        best_of=1,
        temperature=0.0,
        condition_on_previous_text=False,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 600, "speech_pad_ms": 300},
        without_timestamps=True,
        initial_prompt=_WHISPER_PROMPT,
    )
    text = "".join(segment.text for segment in segments).strip()
    language = (getattr(info, "language", None) or "unknown").strip().lower()
    return {"text": text, "language": language}


def _transcribe_openai(audio_file, model_size: str) -> dict:
    model = _openai_whisper_model(model_size)
    result = model.transcribe(
        audio_file,
        task="transcribe",
        fp16=False,
        beam_size=5,
        best_of=1,
        temperature=(0.0, 0.2),
        condition_on_previous_text=False,
        verbose=False,
        initial_prompt=_WHISPER_PROMPT,
    )
    text = (result.get("text") or "").strip()
    language = (result.get("language") or "unknown").strip().lower()
    return {"text": text, "language": language}


def transcribe_audio(audio_file, model_size: str | None = None) -> dict:
    """
    Transcribe in the language that was spoken, including code-switching.

    Returns {"text", "language"}. The model stays loaded for the next recording.
    """
    size = _whisper_size(model_size)
    engine = "faster-whisper" if _use_faster_whisper() else "openai-whisper"
    print(f"Transcribing audio with {engine} '{size}'...")
    spoken = (
        _transcribe_faster(audio_file, size)
        if engine == "faster-whisper"
        else _transcribe_openai(audio_file, size)
    )
    print(
        f"Transcription complete ({spoken['language']}, {len(spoken['text'])} chars)."
    )
    return spoken


def _needs_english(text: str, language: str | None) -> bool:
    lang = (language or "").strip().lower()
    if lang and lang not in {"en", "english"}:
        return True
    letters = re.findall(r"[^\W\d_]", text or "", flags=re.UNICODE)
    latin = re.findall(r"[A-Za-z]", text or "")
    if not letters:
        return False
    return (len(latin) / len(letters)) < 0.85


def translate_to_english(transcript: str, language: str, api_key: str) -> str:
    """English rendering for biography and extraction. Names stay as spoken."""
    if not transcript or not _needs_english(transcript, language):
        return transcript
    print(f"Translating transcript ({language}) into English...")
    client = genai.Client(api_key=api_key)
    prompt = f"""
Translate this family oral-history transcript into clear English.
Keep every personal name exactly as spoken.
If a phrase is already English, keep it.
Do not summarize. Do not add facts. Do not drop names, places, or dates.
If the recording mixes languages, translate the whole meaning into one English transcript.

Source language: {language or "unknown"}

Transcript:
{transcript}
""".strip()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    english = (response.text or "").strip()
    return english or transcript


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
    language: str = "en",
    original_transcript: str | None = None,
) -> None:
    spoken = (original_transcript if original_transcript is not None else transcript).strip()
    english = (transcript or spoken).strip()
    storyteller_hint = person_name_hint
    print(f"[pipeline] archiving story={story_id} in one pass")
    update_processing_job(job_id, stage="writing", progress=0.45)
    archive = None
    try:
        archive = archive_from_transcript(spoken, language, api_key, storyteller_hint)
    except Exception as archive_error:
        print(f"[pipeline] combined archive failed, using separate passes: {archive_error}")

    if archive:
        translated = (archive.get("translation") or "").strip()
        if translated.lower() in {"null", "none"}:
            translated = ""
        if translated and translated != spoken:
            english = translated
        elif _needs_english(spoken, language):
            english = translate_to_english(spoken, language, api_key)
        else:
            english = spoken
        biography = (archive.get("biography") or "").strip()
        extracted_data = {
            "summary": archive.get("summary"),
            "person_info": archive.get("person_info") or {},
            "timeline_events": archive.get("timeline_events") or [],
            "locations": archive.get("locations") or [],
            "occupations": archive.get("occupations") or [],
            "themes": archive.get("themes") or [],
            "family_members": archive.get("family_members") or [],
        }
        if not biography:
            biography = parse_text_gemini(english, api_key)
    else:
        print(f"[pipeline] writing biography for story={story_id}")
        if _needs_english(spoken, language):
            english = translate_to_english(spoken, language, api_key)
        biography = parse_text_gemini(english, api_key)
        print(f"[pipeline] extracting structured data for story={story_id}")
        update_processing_job(job_id, stage="extracting", progress=0.65)
        extracted_data = extract_key_data(english, api_key)
        if not extracted_data:
            raise RuntimeError("Failed to extract structured data from transcript")
        update_processing_job(job_id, stage="extracting", progress=0.78)
        storyteller_hint = (
            person_name_hint
            or (extracted_data.get("person_info") or {}).get("name")
            or None
        )
        try:
            extracted_data["family_members"] = extract_family_tree(
                english, api_key, storyteller_hint
            )
        except Exception as fe:
            print(f"[pipeline] family extract failed, leaving unattached: {fe}")
            extracted_data["family_members"] = []

    storyteller = (
        storyteller_hint
        or (extracted_data.get("person_info") or {}).get("name")
        or None
    )
    if archive:
        try:
            extracted_data["family_members"] = sanitize_family_members(
                extracted_data.get("family_members") or [],
                f"{spoken}\n{english}",
                storyteller,
            )
        except Exception as sanitize_error:
            print(f"[pipeline] family sanitize failed: {sanitize_error}")
            extracted_data["family_members"] = []

    extracted_data["language"] = language
    extracted_data["original_transcript"] = spoken
    if english.strip() != spoken.strip():
        extracted_data["translation"] = english
    else:
        extracted_data["translation"] = None

    summary = extracted_data.get("summary")

    print(f"[pipeline] saving results for story={story_id}")
    update_processing_job(job_id, stage="saving", progress=0.9)
    ok = finalize_story_processing(
        story_id=story_id,
        transcript=spoken,
        biography=biography,
        summary=summary,
        extracted_data=extracted_data,
        person_name_hint=person_name_hint,
        auto_confirm=auto_confirm,
        language=language,
    )
    if not ok:
        raise RuntimeError("finalize_story_processing failed")

    update_processing_job(job_id, stage="completed", progress=1.0)
    print(f"[pipeline] completed story={story_id} job={job_id}")


def _generate(client, prompt: str, *, json_mode: bool = False):
    kwargs = {"model": "gemini-2.5-flash", "contents": prompt}
    if json_mode:
        try:
            from google.genai import types

            kwargs["config"] = types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            )
        except Exception:
            pass
    try:
        return client.models.generate_content(**kwargs)
    except TypeError:
        kwargs.pop("config", None)
        return client.models.generate_content(**kwargs)


def archive_from_transcript(
    transcript: str,
    language: str,
    api_key: str,
    storyteller_name: str | None = None,
) -> dict | None:
    """
    One model call for translation, biography, timeline, and family.

    Separate passes were accurate but slow. This keeps the strict family rules
    and falls back to the older passes if the JSON cannot be parsed.
    """
    who = storyteller_name or "the storyteller (first person: I / me)"
    prompt = f"""
You are VirsaAI, an archivist for spoken family history.
Read the transcript once and return ONLY valid JSON with this shape:
{{
  "translation": "Full English transcript, or null if the source is already English",
  "biography": "English biography with ## section headings. Factual, warm, chronological. Do not invent events.",
  "summary": "Two factual sentences",
  "person_info": {{"name": null, "birth_year": null, "death_year": null, "birth_place": null}},
  "timeline_events": [{{"year": null, "event": "", "description": "", "location": null, "category": null}}],
  "locations": [{{"place": "", "start_year": null, "end_year": null, "purpose": null}}],
  "occupations": [{{"role": "", "start_year": null, "end_year": null, "location": null}}],
  "themes": [],
  "family_members": [{{
    "name": "",
    "relationship_to_storyteller": "father|mother|husband|wife|spouse|son|daughter|brother|sister|relative",
    "cultural_term": null,
    "evidence": "short verbatim phrase",
    "confidence": "high|low",
    "birth_year": null,
    "death_year": null
  }}]
}}

ACCURACY RULES:
- Keep every personal name exactly as spoken. Do not Anglicize names.
- If the recording mixes languages, translate non-English speech into the translation and biography, and keep meaning.
- Do not add relatives, dates, or places that are not said or clearly implied ("when I was 12", "in the 1960s").
- Use null for unknown years. Never guess a specific year.
- biography is English even when the transcript is not.
- translation is the complete English transcript, not a summary. Null only when the transcript is already English.

FAMILY RULES (storyteller: {who}). Relationships are from the storyteller's point of view.
- relationship_to_storyteller must be exactly one of: father, mother, husband, wife, spouse, son, daughter, brother, sister, relative
- Use relative for aunts, uncles, cousins, grandparents, and in-laws. Put the cultural word in cultural_term (chacha, masi, dada, nani, thaya, bhua, mama).
- confidence=high only when evidence is an explicit kinship phrase.
- Do not invent a spouse without marriage language (married, husband, wife, wedding).
- Do not list the storyteller.
- "my father's brother" is relative, cultural_term chacha or thaya, not brother.
- "my older brother" is brother.
- "my father's father" / dada and "my father's mother" / dadi are relative, with that cultural_term.
- "my mother's sister" / masi, "my father's sister" / bhua, "my mother's brother" / mama are relative.
- In-laws (deor, jija, saali, chachi, thayi) are relative. Do not call them brother or sister.
- Do not invent a spouse unless the transcript says married, husband, wife, or wedding.
- confidence=high only for an explicit kinship phrase. Prefer fewer correct people.

Source language: {language or "unknown"}

Transcript:
{transcript}
""".strip()
    client = genai.Client(api_key=api_key)
    response = _generate(client, prompt, json_mode=True)
    data = parse_json_response(response.text or "")
    if not data or not (data.get("biography") or data.get("family_members") or data.get("timeline_events")):
        return None
    return data


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
        spoken = transcribe_audio(audio_path)
        original = (spoken.get("text") or "").strip()
        language = spoken.get("language") or "unknown"
        if not original:
            raise RuntimeError("Transcription produced empty text")

        # One Gemini call translates, writes the biography, and extracts the family.
        _run_post_transcript(
            story_id=story_id,
            job_id=job_id,
            transcript=original,
            api_key=api_key,
            person_name_hint=person_name_hint,
            auto_confirm=auto_confirm,
            language=language,
            original_transcript=original,
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

        original = transcript.strip()
        language = "multilingual" if _needs_english(original, None) else "en"

        # Skip Whisper; one archive call translates when the paste is not English.
        _run_post_transcript(
            story_id=story_id,
            job_id=job_id,
            transcript=original,
            api_key=api_key,
            person_name_hint=person_name_hint,
            auto_confirm=auto_confirm,
            language=language,
            original_transcript=original,
        )
    except Exception as e:
        _fail_job(story_id, job_id, str(e))
