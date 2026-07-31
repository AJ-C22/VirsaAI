"""
Strict family-tree extraction + sanitization.

Philosophy: prefer unattached "relative" over a wrong edge.
Only father/mother/spouse/child/sibling with clear evidence become links.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

# Direct pedigree only — never partner/friend/in-law.
_LINKABLE = frozenset(
    {
        "father",
        "mother",
        "husband",
        "wife",
        "spouse",
        "son",
        "daughter",
        "child",
        "brother",
        "sister",
    }
)

# If these appear in the relationship string, do not auto-link.
_POISON = re.compile(
    r"""
    \b(
      in[\s-]?law | step | half | adopt |
      aunt | uncle | cousin | nephew | niece | grand\w* |
      masi | mama | chacha | taya | bua | nana | nani | dada | dadi |
      bhabi | jija | deor | jeth | nanad | saali | fufad | masa |
      relative | friend | neighbour | neighbor | colleague | teacher |
      spouse'?s | husband'?s | wife'?s | partner'?s |
      brother'?s | sister'?s | father'?s | mother'?s |
      son'?s | daughter'?s
    )\b
    """,
    re.I | re.X,
)

# Optional age qualifier + core direct term (whole string).
_DIRECT_PATTERNS: List[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(?:my\s+)?(?:biological\s+)?(?:father|dad|papa)$", re.I), "father"),
    (re.compile(r"^(?:my\s+)?(?:biological\s+)?(?:mother|mom|mum|mata)$", re.I), "mother"),
    (re.compile(r"^(?:my\s+)?(?:husband)$", re.I), "husband"),
    (re.compile(r"^(?:my\s+)?(?:wife)$", re.I), "wife"),
    (re.compile(r"^(?:my\s+)?(?:spouse)$", re.I), "spouse"),
    (
        re.compile(
            r"^(?:my\s+)?(?:older|younger|big|little|elder|eldest|youngest)?\s*"
            r"(?:brother)$",
            re.I,
        ),
        "brother",
    ),
    (
        re.compile(
            r"^(?:my\s+)?(?:older|younger|big|little|elder|eldest|youngest)?\s*"
            r"(?:sister)$",
            re.I,
        ),
        "sister",
    ),
    (
        re.compile(
            r"^(?:my\s+)?(?:older|younger|eldest|youngest|only)?\s*(?:son)$",
            re.I,
        ),
        "son",
    ),
    (
        re.compile(
            r"^(?:my\s+)?(?:older|younger|eldest|youngest|only)?\s*(?:daughter)$",
            re.I,
        ),
        "daughter",
    ),
    (re.compile(r"^(?:my\s+)?(?:child|children|kid|kids)$", re.I), "child"),
]

_EX_SPOUSE = re.compile(
    r"^(?:my\s+)?(?:ex[\s-]?|former\s+)(?:wife|husband|spouse)$", re.I
)

# Transcript cues that support a given link type near a name.
_SUPPORT_CUES: Dict[str, tuple[str, ...]] = {
    "father": ("father", "dad", "papa", "my father", "my dad"),
    "mother": ("mother", "mom", "mum", "mata", "my mother", "my mom"),
    "husband": ("husband", "married", "marry", "wedding", "wife"),
    "wife": ("wife", "married", "marry", "wedding", "husband"),
    "spouse": ("spouse", "husband", "wife", "married", "marry", "wedding"),
    "brother": ("brother", "brothers"),
    "sister": ("sister", "sisters"),
    "son": ("son", "boys", "my boy", "our son", "children", "child"),
    "daughter": ("daughter", "my girl", "our daughter", "children", "child"),
    "child": ("child", "children", "son", "daughter", "kids"),
}


def canonicalize_relationship(label: Optional[str]) -> str:
    """
    Map free text → one of LINKABLE labels, or 'relative'.
    Conservative: poison phrases and non-exact forms become relative.
    """
    if not label or not str(label).strip():
        return "relative"
    raw = re.sub(r"\s+", " ", str(label).strip().lower())
    raw = raw.replace("(", " ").replace(")", " ").strip()
    raw = re.sub(r"\s+", " ", raw)

    if _POISON.search(raw):
        return "relative"
    if _EX_SPOUSE.match(raw):
        return "spouse"

    for pat, canon in _DIRECT_PATTERNS:
        if pat.match(raw):
            return canon

    # Exact allowlist only
    if raw in _LINKABLE:
        return raw

    return "relative"


def _name_tokens(name: str) -> List[str]:
    parts = re.findall(r"[A-Za-z]{2,}", name or "")
    return [p.lower() for p in parts]


def _transcript_mentions_person(transcript: str, name: str) -> bool:
    t = (transcript or "").lower()
    tokens = _name_tokens(name)
    if not tokens:
        return False
    # Require first name at minimum
    return tokens[0] in t


def _window_around_name(transcript: str, name: str, radius: int = 120) -> str:
    """Concatenate text windows around each mention of the person's first name."""
    t = transcript or ""
    tokens = _name_tokens(name)
    if not tokens:
        return ""
    first = tokens[0]
    windows: List[str] = []
    for m in re.finditer(re.escape(first), t, flags=re.I):
        start = max(0, m.start() - radius)
        end = min(len(t), m.end() + radius)
        windows.append(t[start:end])
    # Also try full name
    full = name.strip()
    if len(tokens) > 1:
        for m in re.finditer(re.escape(full), t, flags=re.I):
            start = max(0, m.start() - radius)
            end = min(len(t), m.end() + radius)
            windows.append(t[start:end])
    return " ".join(windows).lower()


def evidence_supports_link(
    transcript: str, name: str, canon_rel: str, evidence: Optional[str] = None
) -> bool:
    """Require name + kinship cue nearby (or in provided evidence quote)."""
    if canon_rel == "relative" or canon_rel not in _SUPPORT_CUES:
        return False
    if not _transcript_mentions_person(transcript, name):
        return False

    cues = _SUPPORT_CUES[canon_rel]
    blob = _window_around_name(transcript, name)
    if evidence:
        blob = f"{blob} {(evidence or '').lower()}"

    # Spouse needs marriage language somewhere near the name, not just "partner"
    if canon_rel in ("husband", "wife", "spouse"):
        marriage = ("married", "marry", "wedding", "husband", "wife", "spouse")
        if not any(c in blob for c in marriage):
            return False
        return True

    return any(c in blob for c in cues)


def _owned_by_someone_else(text: str, role: str) -> bool:
    """True if kinship is attributed to someone else (Raj's brother), not 'my brother'."""
    if not text:
        return False
    t = text.lower()
    if re.search(rf"\bmy\s+(?:older|younger|big|little|elder)?\s*{role}\b", t):
        return False
    if re.search(
        rf"\b[\w''.]+\s*'s\s+(?:older|younger|big|little|elder)?\s*{role}\b",
        t,
    ):
        return True
    if re.search(rf"\b(his|her|their)\s+(?:older|younger)?\s*{role}\b", t):
        return True
    return False


def sanitize_family_members(
    members: Any,
    transcript: str,
    storyteller_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Clean Gemini family_members into a safe list for tree ingest.

    - Deduplicate by normalized name
    - Force relative unless relationship is clearly linkable + evidenced
    - Never link the storyteller to themselves
    """
    if not isinstance(members, list):
        return []

    subject_tokens = set(_name_tokens(storyteller_name or ""))
    cleaned: List[Dict[str, Any]] = []
    seen_names: set[str] = set()

    for raw in members:
        if not isinstance(raw, dict):
            continue
        name = (raw.get("name") or "").strip()
        if not name or name.lower() in ("unknown", "unknown relative", "n/a"):
            continue

        name_key = re.sub(r"\s+", " ", name.lower())
        if name_key in seen_names:
            continue

        # Skip storyteller
        person_tokens = set(_name_tokens(name))
        if subject_tokens and person_tokens and person_tokens == subject_tokens:
            continue
        if storyteller_name and name_key == storyteller_name.strip().lower():
            continue

        stated = (
            raw.get("relationship_to_storyteller")
            or raw.get("relationship")
            or "relative"
        )
        cultural = (raw.get("cultural_term") or raw.get("notes") or "").strip()
        evidence = (raw.get("evidence") or "").strip()
        confidence = str(raw.get("confidence") or "low").strip().lower()

        canon = canonicalize_relationship(str(stated))
        note_blob = f"{cultural} {stated} {evidence}".lower()

        # Possessive / in-law language → never trust a short direct label
        if _POISON.search(note_blob) and canon in _LINKABLE:
            if re.search(
                r"in[\s-]?law|spouse'?s|husband'?s|wife'?s|brother'?s wife|sister'?s husband|"
                r"masi|mama|chacha|bua|aunt|uncle|cousin",
                note_blob,
                re.I,
            ):
                canon = "relative"

        # "Raj's brother Manjit" must not become storyteller's brother
        if canon in ("brother", "sister", "father", "mother", "son", "daughter"):
            role = {
                "brother": "brother",
                "sister": "sister",
                "father": "father",
                "mother": "mother",
                "son": "son",
                "daughter": "daughter",
            }[canon]
            check_text = f"{evidence} {cultural} {_window_around_name(transcript, name)}"
            if _owned_by_someone_else(check_text, role):
                canon = "relative"

        linkable = False
        if canon in _LINKABLE:
            if evidence_supports_link(transcript, name, canon, evidence or stated):
                # Prefer high/medium confidence, but evidenced clean labels OK
                if confidence in ("high", "medium", "med", "low", ""):
                    linkable = confidence != "low" or bool(evidence)
                if confidence == "low" and not evidence:
                    linkable = False

        final_rel = canon if linkable else "relative"
        notes_parts = []
        if cultural:
            notes_parts.append(cultural)
        if stated and str(stated).lower() != final_rel:
            notes_parts.append(f"Stated as: {stated}")
        if evidence:
            notes_parts.append(f"Evidence: {evidence[:180]}")
        if not linkable and canon != "relative":
            notes_parts.append(
                "Left unattached — relationship not certain enough to auto-link"
            )

        cleaned.append(
            {
                "name": name,
                "relationship": final_rel,
                "birth_year": raw.get("birth_year"),
                "death_year": raw.get("death_year"),
                "notes": " · ".join(notes_parts) if notes_parts else raw.get("notes"),
                "confidence": "high" if linkable else "low",
                "evidence": evidence or None,
            }
        )
        seen_names.add(name_key)

    return cleaned


def family_extract_prompt(transcript: str, storyteller_name: Optional[str]) -> str:
    who = storyteller_name or "the storyteller (first person: I/me)"
    return f"""
You extract family members for a pedigree chart (parents, spouses, children, siblings only).

Storyteller: {who}
All relationships are FROM THE STORYTELLER'S POINT OF VIEW (I / me).

Return ONLY valid JSON:
{{
  "family_members": [
    {{
      "name": "Full name if given, else first name",
      "relationship_to_storyteller": "father|mother|husband|wife|spouse|son|daughter|brother|sister|relative",
      "cultural_term": "optional Punjabi/cultural term e.g. masi, chacha, or null",
      "evidence": "short verbatim phrase from the transcript that proves the relationship",
      "confidence": "high|low",
      "birth_year": null,
      "death_year": null
    }}
  ]
}}

HARD RULES (violations are errors):
1. relationship_to_storyteller must be EXACTLY one of:
   father, mother, husband, wife, spouse, son, daughter, brother, sister, relative
2. Use "relative" whenever you are not 100% sure it is a DIRECT pedigree link to the storyteller.
3. NEVER map in-laws to father/mother/brother/sister.
   - "husband's brother" / "brother-in-law" / "Deor" → relative (cultural_term: brother-in-law)
   - "mother's sister" / "masi" / "aunt" → relative
   - "father-in-law" → relative
4. NEVER invent a spouse from two names appearing together. Need marriage language
   (married, husband, wife, wedding).
5. Multiple spouses/ex-spouses are OK as separate husband/wife/spouse rows with evidence.
6. "older brother" / "younger sister" → brother / sister (not relative).
7. Do NOT list the storyteller themselves.
8. confidence=high ONLY if evidence is an explicit kinship phrase in the transcript.
9. Prefer fewer correct people over a dense wrong tree.
10. Output JSON only — no markdown.

EXAMPLES:
- Transcript: "my mother's sister Parkash" → Parkash, relationship=relative, cultural_term=masi/aunt, confidence=high
- Transcript: "I married Rajinder in 1978" → Rajinder, relationship=husband, evidence="I married Rajinder", confidence=high
- Transcript: "Raj's younger brother Manjit wired money" → Manjit, relationship=relative, cultural_term=brother-in-law, confidence=high
- Transcript: "my older brother Harpreet" → Harpreet, relationship=brother, confidence=high

Transcript:
{transcript}
""".strip()


def parse_json_response(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    json_text = text.strip()
    if json_text.startswith("```json"):
        json_text = json_text[7:]
    if json_text.startswith("```"):
        json_text = json_text[3:]
    if json_text.endswith("```"):
        json_text = json_text[:-3]
    json_text = json_text.strip()
    try:
        data = json.loads(json_text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None
