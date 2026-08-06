"""
Culturally aware kinship labeling for VirsaAI.

Structural edges are only parent / spouse / sibling (child flipped to parent).
Cultural labels (Chacha, Masi, Bhabi, …) are inferred from paths relative to a
viewpoint person (ego).

Punjabi defaults when age is unknown:
  - Father's brother → Chacha (younger), not Taya
  - Husband's brother → Deor (younger), not Jeth
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Lexicons
# ---------------------------------------------------------------------------

PUNJABI: Dict[str, str] = {
    # Self / direct
    "self": "Self",
    "father": "Papa",
    "mother": "Mata Ji",
    "parent": "Parent",
    "spouse_husband": "Husband",
    "spouse_wife": "Wife",
    "spouse": "Spouse",
    "son": "Putt",
    "daughter": "Dhee",
    "child": "Child",
    "brother": "Bhra",
    "brother_older": "Vadda Bhra",
    "brother_younger": "Chhota Bhra",
    "sister": "Bhain",
    "sister_older": "Vaddi Bhain",
    "sister_younger": "Chhoti Bhain",
    "sibling": "Sibling",
    # Paternal grandparents
    "father_father": "Dada",
    "father_mother": "Dadi",
    # Maternal grandparents
    "mother_father": "Nana",
    "mother_mother": "Nani",
    # Great-grandparents
    "father_father_father": "Pardada",
    "father_father_mother": "Pardadi",
    "mother_mother_father": "Parnana",
    "mother_mother_mother": "Parnani",
    # Father's siblings (+ spouses) — default younger when age unknown
    "father_brother": "Chacha",
    "father_brother_younger": "Chacha",
    "father_brother_older": "Taya",
    "father_brother_wife": "Chachi",
    "father_brother_younger_wife": "Chachi",
    "father_brother_older_wife": "Tayi",
    "father_sister": "Bua",
    "father_sister_husband": "Fufad",
    # Mother's siblings (+ spouses)
    "mother_brother": "Mama",
    "mother_brother_wife": "Mami",
    "mother_sister": "Masi",
    "mother_sister_husband": "Masa",
    # Sibling's spouse / children
    "brother_wife": "Bhabi",
    "sister_husband": "Jija",
    "brother_son": "Bhatija",
    "brother_daughter": "Bhatiji",
    "sister_son": "Bhanja",
    "sister_daughter": "Bhanji",
    # Spouse's parents
    "spouse_father": "Sasur",
    "spouse_mother": "Sass",
    # Husband's siblings (ego female / from wife viewpoint) — default younger
    "husband_brother": "Deor",
    "husband_brother_younger": "Deor",
    "husband_brother_older": "Jeth",
    "husband_brother_wife": "Deorani",
    "husband_brother_younger_wife": "Deorani",
    "husband_brother_older_wife": "Jethani",
    "husband_sister": "Nanad",
    "husband_sister_husband": "Nandoi",
    # Wife's siblings (ego male / from husband viewpoint)
    "wife_brother": "Sala",
    "wife_brother_wife": "Salehar",
    "wife_sister": "Saali",
    "wife_sister_husband": "Sandhu",
    # Back-compat ambiguous spouse-sibling keys
    "spouse_brother": "Deor",
    "spouse_sister": "Nanad",
    # Grandchildren
    "son_son": "Pota",
    "son_daughter": "Poti",
    "daughter_son": "Dohta",
    "daughter_daughter": "Dohti",
    "grandchild": "Grandchild",
    # Cousins (paternal / maternal)
    "father_brother_son": "Chachera Bhra",
    "father_brother_daughter": "Chacheri Bhain",
    "father_sister_son": "Buatra Bhra",
    "father_sister_daughter": "Buatri Bhain",
    "mother_brother_son": "Mamera Bhra",
    "mother_brother_daughter": "Mameri Bhain",
    "mother_sister_son": "Masera Bhra",
    "mother_sister_daughter": "Maseri Bhain",
    "cousin": "Cousin",
    "relative": "Rishtedar",
}

CANTONESE: Dict[str, str] = {
    "father": "Ba Ba",
    "mother": "Ma Ma",
    "father_father": "Ye Ye",
    "father_mother": "Maa Maa",
    "mother_father": "Gong Gong",
    "mother_mother": "Lao Lao",
    "father_brother": "Suk",
    "father_brother_younger": "Suk",
    "father_brother_older": "Bak",
    "father_brother_wife": "Suk Mo",
    "father_sister": "Gu",
    "mother_brother": "Kau",
    "mother_brother_wife": "Kau Mo",
    "mother_sister": "Yi",
    "brother_wife": "Sou",
    "sister_husband": "Je Fu",
    "spouse": "Spouse",
    "son": "Son",
    "daughter": "Daughter",
    "brother": "Brother",
    "sister": "Sister",
    "child": "Child",
    "sibling": "Sibling",
    "relative": "Relative",
}

MANDARIN: Dict[str, str] = {
    "father": "Bàba",
    "mother": "Māma",
    "father_father": "Yéye",
    "father_mother": "Nǎinai",
    "mother_father": "Wàigōng",
    "mother_mother": "Lǎolao",
    "father_brother": "Shūshu",
    "father_brother_younger": "Shūshu",
    "father_brother_older": "Bóbo",
    "father_brother_wife": "Shěnshen",
    "father_sister": "Gūgu",
    "mother_brother": "Jiùjiu",
    "mother_brother_wife": "Jiùmá",
    "mother_sister": "Yímā",
    "brother_wife": "Sǎozi",
    "sister_husband": "Jiěfu",
    "spouse": "Spouse",
    "son": "Son",
    "daughter": "Daughter",
    "brother": "Brother",
    "sister": "Sister",
    "child": "Child",
    "sibling": "Sibling",
    "relative": "Relative",
}

GENERIC: Dict[str, str] = {
    "father": "Father",
    "mother": "Mother",
    "parent": "Parent",
    "spouse": "Spouse",
    "spouse_husband": "Husband",
    "spouse_wife": "Wife",
    "child": "Child",
    "son": "Son",
    "daughter": "Daughter",
    "sibling": "Sibling",
    "brother": "Brother",
    "sister": "Sister",
    "father_father": "Paternal Grandfather",
    "father_mother": "Paternal Grandmother",
    "mother_father": "Maternal Grandfather",
    "mother_mother": "Maternal Grandmother",
    "father_brother": "Paternal Uncle",
    "father_brother_younger": "Paternal Uncle (younger)",
    "father_brother_older": "Paternal Uncle (elder)",
    "father_brother_wife": "Paternal Aunt (by marriage)",
    "father_sister": "Paternal Aunt",
    "father_sister_husband": "Paternal Uncle (by marriage)",
    "mother_brother": "Maternal Uncle",
    "mother_brother_wife": "Maternal Aunt (by marriage)",
    "mother_sister": "Maternal Aunt",
    "mother_sister_husband": "Maternal Uncle (by marriage)",
    "brother_wife": "Sister-in-law",
    "sister_husband": "Brother-in-law",
    "spouse_father": "Father-in-law",
    "spouse_mother": "Mother-in-law",
    "husband_brother": "Brother-in-law",
    "husband_sister": "Sister-in-law",
    "wife_brother": "Brother-in-law",
    "wife_sister": "Sister-in-law",
    "brother_son": "Nephew",
    "brother_daughter": "Niece",
    "sister_son": "Nephew",
    "sister_daughter": "Niece",
    "son_son": "Grandson",
    "son_daughter": "Granddaughter",
    "daughter_son": "Grandson",
    "daughter_daughter": "Granddaughter",
    "cousin": "Cousin",
    "relative": "Relative",
}

SYSTEMS = {
    "punjabi": PUNJABI,
    "cantonese": CANTONESE,
    "mandarin": MANDARIN,
    "generic": GENERIC,
}

Edge = Tuple[str, str, str]  # from_id, to_id, type


def _lexicon(system: str) -> Dict[str, str]:
    return SYSTEMS.get((system or "generic").lower(), GENERIC)


def label_for_key(system: str, key: str) -> str:
    lex = _lexicon(system)
    if key in lex:
        return lex[key]
    return key.replace("_", " ").title()


# ---------------------------------------------------------------------------
# Graph helpers
# ---------------------------------------------------------------------------

def _infer_sibling_edges(edges: List[Edge]) -> List[Edge]:
    children_of: Dict[str, set] = {}
    for frm, to, typ in edges:
        t = (typ or "").lower()
        if t == "parent":
            children_of.setdefault(frm, set()).add(to)
        elif t == "child":
            children_of.setdefault(to, set()).add(frm)

    existing = {
        tuple(sorted([a, b]))
        for a, b, typ in edges
        if (typ or "").lower() == "sibling"
    }
    inferred: List[Edge] = []
    for kids in children_of.values():
        kids_list = list(kids)
        for i in range(len(kids_list)):
            for j in range(i + 1, len(kids_list)):
                a, b = kids_list[i], kids_list[j]
                key = tuple(sorted([a, b]))
                if key in existing:
                    continue
                existing.add(key)
                inferred.append((a, b, "sibling"))
    return inferred


def _neighbors(edges: List[Edge]) -> Dict[str, List[Tuple[str, str]]]:
    """Adjacency: person → [(other, role_from_person)]."""
    out: Dict[str, List[Tuple[str, str]]] = {}

    def add(src: str, dst: str, role: str):
        out.setdefault(src, []).append((dst, role))

    for frm, to, typ in list(edges) + _infer_sibling_edges(edges):
        t = (typ or "").lower()
        if t == "parent":
            add(to, frm, "parent")
            add(frm, to, "child")
        elif t == "child":
            add(frm, to, "child")
            add(to, frm, "parent")
        elif t == "spouse":
            add(frm, to, "spouse")
            add(to, frm, "spouse")
        elif t == "sibling":
            add(frm, to, "sibling")
            add(to, frm, "sibling")
    return out


def _norm_sex(sex: Optional[str]) -> Optional[str]:
    if not sex:
        return None
    s = sex.lower().strip()
    if s in ("m", "male", "man", "boy"):
        return "male"
    if s in ("f", "female", "woman", "girl"):
        return "female"
    return None


def _older_than(
    a: str,
    b: str,
    birth_year_by_id: Optional[Dict[str, Optional[int]]],
) -> Optional[bool]:
    """True if a is older than b; None if unknown."""
    if not birth_year_by_id:
        return None
    ya, yb = birth_year_by_id.get(a), birth_year_by_id.get(b)
    if ya is None or yb is None:
        return None
    if ya == yb:
        return None
    return ya < yb  # earlier birth year ⇒ older


def _sex_or(
    person_id: str,
    sex_by_id: Optional[Dict[str, str]],
    fallback: Optional[str] = None,
) -> Optional[str]:
    if sex_by_id and person_id in sex_by_id:
        return _norm_sex(sex_by_id[person_id]) or fallback
    return fallback


# ---------------------------------------------------------------------------
# Path inference
# ---------------------------------------------------------------------------

def infer_relationship_key(
    ego_id: str,
    other_id: str,
    edges: List[Edge],
    sex_hint: Optional[str] = None,
    sex_by_id: Optional[Dict[str, str]] = None,
    birth_year_by_id: Optional[Dict[str, Optional[int]]] = None,
    ego_sex: Optional[str] = None,
) -> Optional[str]:
    """
    Infer a cultural key for `other` relative to `ego`.

    Uses up to 3 structural hops. Age-unknown father's brother → Chacha.
    """
    if ego_id == other_id:
        return None

    sex_by_id = sex_by_id or {}
    other_sex = _norm_sex(sex_hint) or _sex_or(other_id, sex_by_id)
    ego_sex_n = _norm_sex(ego_sex) or _sex_or(ego_id, sex_by_id)
    graph = _neighbors(edges)

    def role_of(src: str, dst: str) -> Optional[str]:
        for d, role in graph.get(src, []):
            if d == dst:
                return role
        return None

    # ----- Direct -----
    direct = role_of(ego_id, other_id)
    if direct == "parent":
        if other_sex == "male":
            return "father"
        if other_sex == "female":
            return "mother"
        return "parent"
    if direct == "child":
        if other_sex == "male":
            return "son"
        if other_sex == "female":
            return "daughter"
        return "child"
    if direct == "spouse":
        if other_sex == "male":
            return "spouse_husband"
        if other_sex == "female":
            return "spouse_wife"
        return "spouse"
    if direct == "sibling":
        older = _older_than(other_id, ego_id, birth_year_by_id)
        if other_sex == "male":
            if older is True:
                return "brother_older"
            if older is False:
                return "brother_younger"
            return "brother"
        if other_sex == "female":
            if older is True:
                return "sister_older"
            if older is False:
                return "sister_younger"
            return "sister"
        return "sibling"

    # Parent sex map for side-aware labels
    parent_sex: Dict[str, Optional[str]] = {}
    for mid, role in graph.get(ego_id, []):
        if role == "parent":
            parent_sex[mid] = _sex_or(mid, sex_by_id)

    # ----- Two hops -----
    for mid, role1 in graph.get(ego_id, []):
        for dst, role2 in graph.get(mid, []):
            if dst != other_id or dst == ego_id:
                continue

            # Grandparents: parent → parent
            if role1 == "parent" and role2 == "parent":
                mid_sex = parent_sex.get(mid)
                if mid_sex == "male":
                    return "father_father" if other_sex != "female" else "father_mother"
                if mid_sex == "female":
                    return "mother_father" if other_sex != "female" else "mother_mother"
                # Unknown parent sex: prefer paternal if unclear
                return "father_father" if other_sex != "female" else "father_mother"

            # Parent's sibling → uncle / aunt
            if role1 == "parent" and role2 == "sibling":
                mid_sex = parent_sex.get(mid)
                if mid_sex == "female":
                    return "mother_brother" if other_sex != "female" else "mother_sister"
                # Father's side (or unknown parent → treat as paternal)
                if other_sex == "female":
                    return "father_sister"
                # Father's brother: Taya if older than father, else Chacha (default)
                older = _older_than(other_id, mid, birth_year_by_id)
                if older is True:
                    return "father_brother_older"
                if older is False:
                    return "father_brother_younger"
                return "father_brother"  # default Chacha

            # Sibling's spouse
            if role1 == "sibling" and role2 == "spouse":
                mid_sex = _sex_or(mid, sex_by_id)
                if mid_sex == "female" or other_sex == "male":
                    # sister's husband
                    if other_sex == "male" or mid_sex == "female":
                        return "sister_husband"
                return "brother_wife"

            # Sibling's child → niece / nephew
            if role1 == "sibling" and role2 == "child":
                mid_sex = _sex_or(mid, sex_by_id)
                if mid_sex == "female":
                    return "sister_son" if other_sex != "female" else "sister_daughter"
                return "brother_son" if other_sex != "female" else "brother_daughter"

            # Child's child → grandchild
            if role1 == "child" and role2 == "child":
                mid_sex = _sex_or(mid, sex_by_id)
                if mid_sex == "female":
                    return (
                        "daughter_son" if other_sex != "female" else "daughter_daughter"
                    )
                return "son_son" if other_sex != "female" else "son_daughter"

            # Spouse's parent → in-laws
            if role1 == "spouse" and role2 == "parent":
                return "spouse_father" if other_sex != "female" else "spouse_mother"

            # Spouse's sibling → in-laws (side depends on spouse sex)
            if role1 == "spouse" and role2 == "sibling":
                spouse_sex = _sex_or(mid, sex_by_id)
                if spouse_sex == "male" or ego_sex_n == "female":
                    # Husband's side
                    if other_sex == "female":
                        return "husband_sister"
                    older = _older_than(other_id, mid, birth_year_by_id)
                    if older is True:
                        return "husband_brother_older"
                    if older is False:
                        return "husband_brother_younger"
                    return "husband_brother"  # default Deor
                # Wife's side
                if other_sex == "female":
                    return "wife_sister"
                return "wife_brother"

    # ----- Three hops -----
    for mid1, role1 in graph.get(ego_id, []):
        for mid2, role2 in graph.get(mid1, []):
            if mid2 == ego_id:
                continue
            for dst, role3 in graph.get(mid2, []):
                if dst != other_id or dst in (ego_id, mid1):
                    continue

                # Parent → sibling → spouse  (Chachi, Tayi, Mami, Masa, Fufad)
                if role1 == "parent" and role2 == "sibling" and role3 == "spouse":
                    parent_s = parent_sex.get(mid1)
                    sib_sex = _sex_or(mid2, sex_by_id)
                    if parent_s == "female":
                        if sib_sex == "male":
                            return "mother_brother_wife"  # Mami
                        return "mother_sister_husband"  # Masa
                    # Paternal (or unknown)
                    if sib_sex == "female":
                        return "father_sister_husband"  # Fufad
                    older = _older_than(mid2, mid1, birth_year_by_id)
                    if older is True:
                        return "father_brother_older_wife"  # Tayi
                    if older is False:
                        return "father_brother_younger_wife"  # Chachi
                    return "father_brother_wife"  # default Chachi

                # Parent → sibling → child  (cousins)
                if role1 == "parent" and role2 == "sibling" and role3 == "child":
                    parent_s = parent_sex.get(mid1)
                    sib_sex = _sex_or(mid2, sex_by_id)
                    male_cousin = other_sex != "female"
                    if parent_s == "female":
                        if sib_sex == "male":
                            return (
                                "mother_brother_son"
                                if male_cousin
                                else "mother_brother_daughter"
                            )
                        return (
                            "mother_sister_son"
                            if male_cousin
                            else "mother_sister_daughter"
                        )
                    if sib_sex == "female":
                        return (
                            "father_sister_son"
                            if male_cousin
                            else "father_sister_daughter"
                        )
                    return (
                        "father_brother_son"
                        if male_cousin
                        else "father_brother_daughter"
                    )

                # Parent → parent → parent  (great-grandparents, light)
                if role1 == "parent" and role2 == "parent" and role3 == "parent":
                    p1 = parent_sex.get(mid1)
                    if p1 == "male":
                        return (
                            "father_father_father"
                            if other_sex != "female"
                            else "father_father_mother"
                        )
                    if p1 == "female":
                        return (
                            "mother_mother_father"
                            if other_sex != "female"
                            else "mother_mother_mother"
                        )
                    return "father_father_father"

                # Spouse → sibling → spouse
                if role1 == "spouse" and role2 == "sibling" and role3 == "spouse":
                    spouse_sex = _sex_or(mid1, sex_by_id)
                    sib_sex = _sex_or(mid2, sex_by_id)
                    if spouse_sex == "male" or ego_sex_n == "female":
                        if sib_sex == "female":
                            return "husband_sister_husband"  # Nandoi
                        older = _older_than(mid2, mid1, birth_year_by_id)
                        if older is True:
                            return "husband_brother_older_wife"
                        return "husband_brother_younger_wife"
                    if sib_sex == "male":
                        return "wife_brother_wife"
                    return "wife_sister_husband"

                # Sibling → spouse already covered; sibling → child covered

    return "relative"


def cultural_label(
    system: str,
    ego_id: str,
    other_id: str,
    edges: List[Edge],
    other_sex: Optional[str] = None,
    parent_of_ego_sex: Optional[Dict[str, str]] = None,
    sex_by_id: Optional[Dict[str, str]] = None,
    birth_year_by_id: Optional[Dict[str, Optional[int]]] = None,
    ego_sex: Optional[str] = None,
) -> str:
    """Return a culturally appropriate kinship term for other relative to ego."""
    # parent_of_ego_sex kept for API compat; sex_by_id is preferred
    key = infer_relationship_key(
        ego_id,
        other_id,
        edges,
        sex_hint=other_sex,
        sex_by_id=sex_by_id or parent_of_ego_sex,
        birth_year_by_id=birth_year_by_id,
        ego_sex=ego_sex,
    )
    if not key:
        return "Self"
    return label_for_key(system, key)


def label_all_relatives(
    system: str,
    ego_id: str,
    person_ids: List[str],
    edges: List[Edge],
    sex_by_id: Optional[Dict[str, str]] = None,
    birth_year_by_id: Optional[Dict[str, Optional[int]]] = None,
) -> Dict[str, str]:
    sex_by_id = sex_by_id or {}
    birth_year_by_id = birth_year_by_id or {}
    graph = _neighbors(edges)
    parent_of_ego_sex = {
        mid: sex_by_id[mid]
        for mid, role in graph.get(ego_id, [])
        if role == "parent" and mid in sex_by_id
    }
    ego_sex = sex_by_id.get(ego_id)
    labels: Dict[str, str] = {}
    for pid in person_ids:
        if pid == ego_id:
            labels[pid] = "Self"
        else:
            labels[pid] = cultural_label(
                system,
                ego_id,
                pid,
                edges,
                other_sex=sex_by_id.get(pid),
                parent_of_ego_sex=parent_of_ego_sex,
                sex_by_id=sex_by_id,
                birth_year_by_id=birth_year_by_id,
                ego_sex=ego_sex,
            )
    return labels
