"""Viewpoint kinship labels. Run: python test_kinship.py"""
from kinship import cultural_label


def edge(frm, to, typ):
    return (frm, to, typ)


def test_punjabi_from_each_viewpoint():
    edges = [
        edge("pardada", "dada", "parent"),
        edge("pardada", "dada_brother", "parent"),
        edge("dada", "father", "parent"),
        edge("dadi", "father", "parent"),
        edge("dada", "thaya", "parent"),
        edge("dada", "chacha", "parent"),
        edge("dada", "bhua", "parent"),
        edge("dada_brother", "father_cousin", "parent"),
        edge("nana", "mother", "parent"),
        edge("nani", "mother", "parent"),
        edge("nana", "mama", "parent"),
        edge("nana", "masi", "parent"),
        edge("parnana", "nana", "parent"),
        edge("parnana", "nana_sib", "parent"),
        edge("nana_sib", "mother_cousin", "parent"),
        edge("dada", "unknown_uncle", "parent"),
        edge("father", "ego", "parent"),
        edge("mother", "ego", "parent"),
        edge("father", "didi", "parent"),
        edge("father", "bhaji", "parent"),
        edge("thaya", "thayi", "spouse"),
        edge("chacha", "chachi", "spouse"),
        edge("bhua", "fufur", "spouse"),
        edge("mama", "mami", "spouse"),
        edge("masi", "masar", "spouse"),
        edge("father_cousin", "cousin_wife", "spouse"),
        edge("ego", "child", "parent"),
    ]
    sex = {
        "ego": "male",
        "father": "male",
        "mother": "female",
        "dada": "male",
        "dadi": "female",
        "pardada": "male",
        "dada_brother": "male",
        "father_cousin": "male",
        "cousin_wife": "female",
        "thaya": "male",
        "thayi": "female",
        "chacha": "male",
        "chachi": "female",
        "bhua": "female",
        "fufur": "male",
        "nana": "male",
        "nani": "female",
        "parnana": "male",
        "nana_sib": "male",
        "mother_cousin": "male",
        "unknown_uncle": "male",
        "mama": "male",
        "mami": "female",
        "masi": "female",
        "masar": "male",
        "didi": "female",
        "bhaji": "male",
        "child": "male",
    }
    years = {
        "father": 1960,
        "thaya": 1950,
        "chacha": 1968,
        "father_cousin": 1952,
        "mother": 1962,
    }

    def label(ego, other):
        return cultural_label(
            "punjabi",
            ego,
            other,
            edges,
            sex_by_id=sex,
            birth_year_by_id=years,
            ego_sex=sex[ego],
        )

    expect = {
        ("ego", "didi"): "Didi",
        ("ego", "bhaji"): "Bhaji",
        ("ego", "father"): "Papa",
        ("ego", "mother"): "Mata Ji",
        ("ego", "dada"): "Dada",
        ("ego", "dadi"): "Dadi",
        ("ego", "nana"): "Nana",
        ("ego", "nani"): "Nani",
        ("ego", "pardada"): "Pardada",
        ("ego", "thaya"): "Thaya",
        ("ego", "thayi"): "Thayi",
        ("ego", "chacha"): "Chacha",
        ("ego", "chachi"): "Chachi",
        ("ego", "bhua"): "Bhua",
        ("ego", "fufur"): "Fufur",
        ("ego", "mama"): "Mama",
        ("ego", "mami"): "Mami",
        ("ego", "masi"): "Masi",
        ("ego", "masar"): "Masar",
        ("ego", "father_cousin"): "Thaya",
        ("ego", "cousin_wife"): "Thayi",
        ("ego", "mother_cousin"): "Mama",
        ("ego", "unknown_uncle"): "Chacha",
        ("ego", "child"): "Putt",
        # Same people, father's point of view.
        ("father", "ego"): "Putt",
        ("father", "didi"): "Dhee",
        ("father", "thaya"): "Bhaji",
        ("father", "mother"): "Wife",
        ("father", "dada"): "Papa",
    }
    failed = []
    for (ego, other), wanted in expect.items():
        got = label(ego, other)
        if got != wanted:
            failed.append(f"{ego} → {other}: {got!r} expected {wanted!r}")
    if failed:
        raise SystemExit("\n".join(failed))
    print(f"ok {len(expect)} kinship labels")


if __name__ == "__main__":
    test_punjabi_from_each_viewpoint()
