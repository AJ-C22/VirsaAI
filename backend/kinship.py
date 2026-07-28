"""
Culturally aware kinship labeling for VirsaAI.

Infers terms like Chacha, Bhabi, Lao Lao from graph structure + kinship system.
Relationship edges use structural types (parent, child, spouse, sibling…);
cultural labels are derived relative to a viewpoint person (ego).
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

# Structural path patterns → cultural labels by system.
# Paths are sequences of edge types walking FROM ego TO relative.
# Direction: we walk outbound edges as stored (parent means from=parent to=child,
# so from ego's parent toward ego is reverse). For labeling we use role relative
# to ego using a simplified family-role map from direct edges + one-hop.

PUNJABI: Dict[str, str] = {
    # Direct
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
    "sister": "Bhain",
    "sibling": "Sibling",
    # Father's side
    "father_brother_younger": "Chacha",
    "father_brother_older": "Taya",
    "father_brother": "Chacha",
    "father_brother_wife": "Chachi",
    "father_sister": "Bua",
    "father_sister_husband": "Fufad",
    # Mother's side
    "mother_brother": "Mama",
    "mother_brother_wife": "Mami",
    "mother_sister": "Masi",
    "mother_sister_husband": "Masa",
    # Grandparents
    "father_father": "Dada",
    "father_mother": "Dadi",
    "mother_father": "Nana",
    "mother_mother": "Nani",
    # In-laws
    "brother_wife": "Bhabi",
    "sister_husband": "Jija",
    "spouse_brother": "Deor / Jeth",
    "spouse_sister": "Nanad / Saali",
}

CANTONESE: Dict[str, str] = {
    "father": "Ba Ba",
    "mother": "Ma Ma",
    "father_father": "Ye Ye",
    "father_mother": "Maa Maa",
    "mother_father": "Gong Gong",
    "mother_mother": "Lao Lao",
    "father_brother_older": "Bak",
    "father_brother_younger": "Suk",
    "mother_brother": "Kau",
    "brother_wife": "Sou",
    "sister_husband": "Je Fu",
    "spouse": "Spouse",
    "child": "Child",
    "sibling": "Sibling",
}

MANDARIN: Dict[str, str] = {
    "father": "Bàba",
    "mother": "Māma",
    "father_father": "Yéye",
    "father_mother": "Nǎinai",
    "mother_father": "Wàigōng",
    "mother_mother": "Lǎolao",
    "father_brother_older": "Bóbo",
    "father_brother_younger": "Shūshu",
    "mother_brother": "Jiùjiu",
    "brother_wife": "Sǎozi",
    "sister_husband": "Jiěfu",
}

GENERIC: Dict[str, str] = {
    "father": "Father",
    "mother": "Mother",
    "parent": "Parent",
    "spouse": "Spouse",
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
    "mother_brother": "Maternal Uncle",
    "father_sister": "Paternal Aunt",
    "mother_sister": "Maternal Aunt",
    "brother_wife": "Sister-in-law",
    "sister_husband": "Brother-in-law",
}

SYSTEMS = {
    "punjabi": PUNJABI,
    "cantonese": CANTONESE,
    "mandarin": MANDARIN,
    "generic": GENERIC,
}


def _lexicon(system: str) -> Dict[str, str]:
    return SYSTEMS.get((system or "generic").lower(), GENERIC)


def label_for_key(system: str, key: str) -> str:
    lex = _lexicon(system)
    if key in lex:
        return lex[key]
    # fallback: humanize
    return key.replace("_", " ").title()


Edge = Tuple[str, str, str]  # from_id, to_id, type


def _neighbors(
    person_id: str, edges: List[Edge]
) -> Dict[str, List[Tuple[str, str]]]:
    """
    Return adjacency with role-from-ego semantics.
    For each stored edge, emit both structural views when possible.
    """
    out: Dict[str, List[Tuple[str, str]]] = {}

    def add(src: str, dst: str, role: str):
        out.setdefault(src, []).append((dst, role))

    for frm, to, typ in edges:
        t = (typ or "relative").lower()
        if t == "parent":
            add(to, frm, "parent")  # child's parent
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
        elif t == "grandparent":
            add(to, frm, "grandparent")
            add(frm, to, "grandchild")
        else:
            add(frm, to, t)
            add(to, frm, "relative")
    return out


def infer_relationship_key(
    ego_id: str,
    other_id: str,
    edges: List[Edge],
    sex_hint: Optional[str] = None,
) -> Optional[str]:
    """
    Infer a cultural key for other relative to ego using up to 2 hops.
    sex_hint: 'male' | 'female' | None for the *other* person when useful.
    """
    if ego_id == other_id:
        return None

    graph = _neighbors(ego_id, edges)
    # Direct
    for dst, role in graph.get(ego_id, []):
        if dst == other_id:
            if role == "parent":
                if sex_hint == "male":
                    return "father"
                if sex_hint == "female":
                    return "mother"
                return "parent"
            if role == "child":
                if sex_hint == "male":
                    return "son"
                if sex_hint == "female":
                    return "daughter"
                return "child"
            if role == "spouse":
                if sex_hint == "male":
                    return "spouse_husband"
                if sex_hint == "female":
                    return "spouse_wife"
                return "spouse"
            if role == "sibling":
                if sex_hint == "male":
                    return "brother"
                if sex_hint == "female":
                    return "sister"
                return "sibling"
            return role

    # Two-hop patterns
    for mid, role1 in graph.get(ego_id, []):
        for dst, role2 in graph.get(mid, []):
            if dst != other_id or dst == ego_id:
                continue
            # grandparents
            if role1 == "parent" and role2 == "parent":
                # need which parent — approximate via mid's link; use father/mother if sex known on mid
                # Without mid sex, return generic grandparent side unknown → father_father default weak
                return "father_father"  # refined below if we know mid
            if role1 == "parent" and role2 == "sibling":
                # uncle/aunt
                return "father_brother" if sex_hint != "female" else "father_sister"
            if role1 == "sibling" and role2 == "spouse":
                return "brother_wife" if sex_hint == "female" else "sister_husband"
            if role1 == "spouse" and role2 == "sibling":
                return "spouse_brother" if sex_hint != "female" else "spouse_sister"

    # Refined parent→parent with mid sex from person map not available here
    for mid, role1 in graph.get(ego_id, []):
        if role1 != "parent":
            continue
        for dst, role2 in graph.get(mid, []):
            if dst != other_id or role2 != "parent":
                continue
            # mid is ego's parent; other is mid's parent
            # without mid sex we can't know paternal vs maternal — caller may pass mid_sex
            return "father_father"

    return "relative"


def cultural_label(
    system: str,
    ego_id: str,
    other_id: str,
    edges: List[Edge],
    other_sex: Optional[str] = None,
    parent_of_ego_sex: Optional[Dict[str, str]] = None,
) -> str:
    """
    Return a culturally appropriate kinship term for other relative to ego.
    parent_of_ego_sex: map parent_person_id → 'male'|'female' for side-aware labels.
    """
    graph = _neighbors(ego_id, edges)

    # Side-aware grandparents / uncles
    for mid, role1 in graph.get(ego_id, []):
        if role1 != "parent":
            continue
        mid_sex = (parent_of_ego_sex or {}).get(mid)
        for dst, role2 in graph.get(mid, []):
            if dst != other_id:
                continue
            if role2 == "parent":
                if mid_sex == "male":
                    key = "father_father" if other_sex != "female" else "father_mother"
                elif mid_sex == "female":
                    key = "mother_father" if other_sex != "female" else "mother_mother"
                else:
                    key = "father_father" if other_sex != "female" else "father_mother"
                return label_for_key(system, key)
            if role2 == "sibling":
                if mid_sex == "female":
                    key = "mother_brother" if other_sex != "female" else "mother_sister"
                else:
                    key = "father_brother" if other_sex != "female" else "father_sister"
                return label_for_key(system, key)
            if role2 == "spouse":
                # uncle's wife / aunt's husband via parent's sibling's spouse is 3 hops; skip
                pass

    key = infer_relationship_key(ego_id, other_id, edges, other_sex)
    if not key:
        return "Self"
    return label_for_key(system, key)


def label_all_relatives(
    system: str,
    ego_id: str,
    person_ids: List[str],
    edges: List[Edge],
    sex_by_id: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    sex_by_id = sex_by_id or {}
    parent_sex = {
        pid: sex_by_id[pid]
        for pid in person_ids
        if pid in sex_by_id
    }
    # Build parent_of_ego_sex more carefully
    graph = _neighbors(ego_id, edges)
    parent_of_ego_sex = {
        mid: sex_by_id.get(mid, "")
        for mid, role in graph.get(ego_id, [])
        if role == "parent" and mid in sex_by_id
    }
    labels = {}
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
                parent_of_ego_sex=parent_of_ego_sex or parent_sex,
            )
    return labels
