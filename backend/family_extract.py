"""
Strict family-tree extraction + sanitization.

Philosophy: prefer unattached "relative" over a wrong edge.
Only father/mother/spouse/child/sibling with clear evidence become links.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

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
    "father": ("father", "dad", "papa", "my father", "my dad", "pita", "pitaji", "bauji"),
    "mother": ("mother", "mom", "mum", "mata", "my mother", "my mom", "beji", "biji", "mummy"),
    "husband": ("husband", "married", "marry", "wedding", "wife", "pati"),
    "wife": ("wife", "married", "marry", "wedding", "husband", "patni"),
    "spouse": ("spouse", "husband", "wife", "married", "marry", "wedding"),
    "brother": ("brother", "brothers", "bhaji", "bhra", "veer", "pra"),
    "sister": ("sister", "sisters", "didi", "bhain", "behen", "bhen"),
    "son": ("son", "boys", "my boy", "our son", "children", "child", "putt", "puttar", "beta"),
    "daughter": ("daughter", "my girl", "our daughter", "children", "child", "dhee", "beti"),
    "child": ("child", "children", "son", "daughter", "kids", "putt", "dhee", "beta", "beti"),
}

# Extended blood relatives, attached only when the parent anchor already exists.
# (hint, sex). Checked against stated relationship + cultural term + evidence.
_EXTENDED_HINTS: List[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r"\b(dada|father'?s father|paternal grandfather)\b", re.I), "parent_of_father", "male"),
    (re.compile(r"\b(dadi|father'?s mother|paternal grandmother)\b", re.I), "parent_of_father", "female"),
    (re.compile(r"\b(nana|mother'?s father|maternal grandfather)\b", re.I), "parent_of_mother", "male"),
    (re.compile(r"\b(nani|mother'?s mother|maternal grandmother)\b", re.I), "parent_of_mother", "female"),
    (
        re.compile(
            r"\b(thaya|taya|chacha|father'?s (?:older |elder |younger |big |little )?(?:brother|bhaji)|paternal uncle)\b",
            re.I,
        ),
        "sibling_of_father",
        "male",
    ),
    (
        re.compile(
            r"\b(bhua|bua|phuphi|father'?s (?:older |elder |younger )?(?:sister|didi)|paternal aunt)\b",
            re.I,
        ),
        "sibling_of_father",
        "female",
    ),
    (
        re.compile(
            r"\b(mama|mother'?s (?:older |elder |younger )?(?:brother|bhaji)|maternal uncle)\b",
            re.I,
        ),
        "sibling_of_mother",
        "male",
    ),
    (
        re.compile(
            r"\b(masi|massi|mother'?s (?:older |elder |younger )?(?:sister|didi)|maternal aunt)\b",
            re.I,
        ),
        "sibling_of_mother",
        "female",
    ),
]


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


def extended_link_hint(text: str) -> Optional[tuple[str, str]]:
    """
    Return (link_hint, sex) for a clear extended blood relative.

    link_hint is parent_of_father, sibling_of_father, parent_of_mother,
    or sibling_of_mother. Spouses of those relatives stay manual.
    """
    blob = re.sub(r"\s+", " ", (text or "").lower()).strip()
    if not blob:
        return None
    if re.search(r"\bin[\s-]?law\b", blob):
        return None
    for pattern, hint, sex in _EXTENDED_HINTS:
        if pattern.search(blob):
            return hint, sex
    return None


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
        hint_blob = f"{stated} {cultural} {evidence}"
        hint = None
        if final_rel == "relative":
            hint = extended_link_hint(hint_blob)
            if hint and _owned_by_someone_else(hint_blob, "brother" if hint[1] == "male" else "sister"):
                # "Raj's chacha" is not the storyteller's father's brother.
                if not re.search(r"\bmy\b", hint_blob, re.I):
                    hint = None
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
                "link_hint": hint[0] if hint else None,
                "implied_sex": hint[1] if hint else None,
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


_NAME_SKIP = {"singh", "kaur"}


def named_family_links(
    text: str, people: List[Tuple[str, str]]
) -> List[Tuple[str, str, str]]:
    """
    Link someone to the relative the story actually names.

    "Jasbir married Harjit" is a spouse edge. "Simran's mother, Parkash"
    is a parent edge. "Simran's brother, Tejinder" is a sibling edge.
    A marriage told as "I married …" stays with the direct storyteller link.
    """
    aliases = _person_aliases(people)
    if not text or not aliases:
        return []
    spans = _name_spans(text, aliases)
    found: List[Tuple[str, str, str]] = []
    seen: set[Tuple[str, str, str]] = set()

    def keep(edge: Tuple[str, str, str]) -> None:
        if edge[0] == edge[1] or edge in seen:
            return
        seen.add(edge)
        found.append(edge)

    for match in re.finditer(r"\b(?:married|marries|marry|wedded|wed)\b", text, re.I):
        clause_lo, clause_hi = _clause_bounds(text, match.start())
        left = _nearest_span(
            spans, match.start(), before=True, window=80, lo=clause_lo, hi=clause_hi
        )
        right = _nearest_span(
            spans, match.end(), before=False, window=50, lo=clause_lo, hi=clause_hi
        )
        if left and right and left[2] != right[2]:
            a, b = sorted((left[2], right[2]))
            keep((a, b, "spouse"))

    role_re = re.compile(
        r"^(?:'s|’s)\s+(mother|father|mom|dad|brother|sister|husband|wife)\b",
        re.I,
    )
    for start, end, owner in spans:
        role_match = role_re.match(text[end : end + 24])
        if not role_match:
            continue
        other = _nearest_span(
            spans, end + role_match.end(), before=False, window=40
        )
        if not other or other[2] == owner:
            continue
        role = role_match.group(1).lower()
        if role in ("mother", "father", "mom", "dad"):
            keep((other[2], owner, "parent"))
        elif role in ("brother", "sister"):
            a, b = sorted((owner, other[2]))
            keep((a, b, "sibling"))
        else:
            a, b = sorted((owner, other[2]))
            keep((a, b, "spouse"))
    return found


def _person_aliases(people: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    full: Dict[str, List[str]] = {}
    first: Dict[str, List[str]] = {}
    for person_id, raw_name in people:
        name = re.sub(r"\s+", " ", (raw_name or "").strip())
        if not name:
            continue
        full.setdefault(name.lower(), []).append(person_id)
        given = name.split()[0].lower()
        if len(given) >= 3 and given not in _NAME_SKIP:
            first.setdefault(given, []).append(person_id)
    aliases: List[Tuple[str, str]] = []
    for label, ids in full.items():
        if len(set(ids)) == 1:
            aliases.append((label, ids[0]))
    for label, ids in first.items():
        if len(set(ids)) == 1 and label not in full:
            aliases.append((label, ids[0]))
    aliases.sort(key=lambda item: len(item[0]), reverse=True)
    return aliases


def _name_spans(
    text: str, aliases: List[Tuple[str, str]]
) -> List[Tuple[int, int, str]]:
    lookup = {label: person_id for label, person_id in aliases}
    pattern = re.compile(
        r"\b(?:" + "|".join(re.escape(label) for label, _ in aliases) + r")\b",
        re.I,
    )
    return [
        (match.start(), match.end(), lookup[match.group(0).lower()])
        for match in pattern.finditer(text)
    ]


def _clause_bounds(text: str, pos: int) -> Tuple[int, int]:
    """Keep a marriage inside one sentence, so the previous line is not a spouse."""
    previous = max((text.rfind(mark, 0, pos) for mark in ".!?\n"), default=-1)
    following = [text.find(mark, pos) for mark in ".!?\n"]
    following = [index for index in following if index >= 0]
    return previous + 1, min(following) if following else len(text)


def _nearest_span(
    spans: List[Tuple[int, int, str]],
    pos: int,
    before: bool,
    window: int,
    lo: int = 0,
    hi: Optional[int] = None,
) -> Optional[Tuple[int, int, str]]:
    end_limit = hi if hi is not None else 10**9
    best: Optional[Tuple[int, int, str]] = None
    for start, end, person_id in spans:
        if start < lo or end > end_limit:
            continue
        if before:
            if end <= pos and pos - end <= window and (best is None or end > best[1]):
                best = (start, end, person_id)
        elif start >= pos and start - pos <= window and (best is None or start < best[0]):
            best = (start, end, person_id)
    return best


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
