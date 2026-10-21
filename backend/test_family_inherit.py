"""A new sibling or child inherits the family they were attached to."""
from family_inherit import inherited_parent_edges
from kinship import cultural_label

SEX = {
    "mohinder": "male",
    "balbir": "female",
    "gurpreet": "male",
    "simran": "female",
    "jasbir": "male",
    "aman": "male",
    "ajai": "male",
    "rohan": "male",
}


def label(ego, other, edges):
    return cultural_label(
        "punjabi",
        ego,
        other,
        edges,
        sex_by_id=SEX,
        ego_sex=SEX.get(ego),
    )


def test_sibling_inherits_parents_and_the_names_above_them():
    edges = [
        ("mohinder", "gurpreet", "parent"),
        ("balbir", "gurpreet", "parent"),
        ("gurpreet", "jasbir", "sibling"),
        ("gurpreet", "aman", "parent"),
        ("gurpreet", "simran", "spouse"),
        ("ajai", "aman", "sibling"),
    ]
    added = inherited_parent_edges(edges)
    parents_of_ajai = {parent for parent, child, _ in added if child == "ajai"}
    assert parents_of_ajai == {"gurpreet", "simran"}
    full = edges + added
    assert label("ajai", "aman", full) == "Bhaji"
    assert label("ajai", "gurpreet", full) == "Papa"
    assert label("ajai", "simran", full) == "Mata Ji"
    assert label("ajai", "mohinder", full) == "Dada"
    assert label("ajai", "balbir", full) == "Dadi"
    assert label("ajai", "jasbir", full) == "Chacha"


def test_son_sees_grandfather_and_uncle():
    edges = [
        ("gurpreet", "aman", "parent"),
        ("aman", "rohan", "sibling"),
        ("aman", "ajai", "parent"),
    ]
    full = edges + inherited_parent_edges(edges)
    assert label("ajai", "aman", full) == "Papa"
    assert label("ajai", "gurpreet", full) == "Dada"
    assert label("ajai", "rohan", full) == "Chacha"


def test_a_spouse_does_not_inherit_blood_parents():
    edges = [
        ("gurpreet", "aman", "parent"),
        ("ajai", "aman", "spouse"),
    ]
    added = inherited_parent_edges(edges)
    assert not any(child == "ajai" for _, child, _ in added)


def test_legacy_child_rows_point_downward():
    edges = [
        ("gurpreet", "aman", "child"),
        ("ajai", "aman", "sibling"),
    ]
    added = inherited_parent_edges(edges)
    assert ("gurpreet", "ajai", "parent") in added
    assert ("aman", "gurpreet", "parent") not in added


def test_does_not_create_a_parent_cycle():
    edges = [
        ("parent", "child", "parent"),
        ("child", "parent", "sibling"),
    ]
    added = inherited_parent_edges(edges)
    assert ("child", "parent", "parent") not in added


if __name__ == "__main__":
    test_sibling_inherits_parents_and_the_names_above_them()
    test_son_sees_grandfather_and_uncle()
    test_a_spouse_does_not_inherit_blood_parents()
    test_legacy_child_rows_point_downward()
    test_does_not_create_a_parent_cycle()
    print("ok family inherit")
