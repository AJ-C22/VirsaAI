"""A named marriage or in-law becomes a real pedigree edge."""
from family_extract import named_family_links

PEOPLE = [
    ("jasbir", "Jasbir Singh"),
    ("harjit", "Harjit Kaur"),
    ("manpreet", "Manpreet Kaur"),
    ("ravi", "Ravi Singh"),
    ("simran", "Simran Kaur"),
    ("parkash", "Parkash Kaur"),
    ("tejinder", "Tejinder Singh"),
    ("gurpreet", "Gurpreet Singh"),
]

TRANSCRIPT = """
I have one older brother, Jasbir Singh, and one younger sister, Manpreet Kaur.

In 1985 I married Simran Kaur in Ludhiana. After we married, we lived with my parents.
My brother Jasbir stayed in Ludhiana and later married Harjit Kaur.
My sister Manpreet married Ravi Singh and they also live in Brampton.
Simran’s mother, Parkash Kaur, visited us from India in 1999.
Simran’s brother, Tejinder Singh, helped us when we first arrived in Canada.
"""


def test_named_marriages_and_inlaws():
    edges = set(named_family_links(TRANSCRIPT, PEOPLE))
    assert ("harjit", "jasbir", "spouse") in edges
    assert ("manpreet", "ravi", "spouse") in edges
    assert ("parkash", "simran", "parent") in edges
    assert ("simran", "tejinder", "sibling") in edges
    assert ("manpreet", "simran", "spouse") not in edges
    assert named_family_links("I married Simran Kaur in Ludhiana.", PEOPLE) == []


if __name__ == "__main__":
    test_named_marriages_and_inlaws()
    print("ok named links")
