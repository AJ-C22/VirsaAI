"""
Fill in the blood family of someone who was added by a single link.

A sibling with no parents shares their sibling's parents. A child of someone
with one spouse is also that spouse's child. Kinship labels then work from
the new person's point of view: a brother's father is Papa, and that man's
father is Dada.
"""
from __future__ import annotations

from typing import Dict, List, Set, Tuple

Edge = Tuple[str, str, str]


def inherited_parent_edges(edges: List[Edge]) -> List[Edge]:
    """Return parent edges (parent, child, 'parent') implied by blood links."""
    parents_of: Dict[str, Set[str]] = {}
    children_of: Dict[str, Set[str]] = {}
    spouses_of: Dict[str, Set[str]] = {}
    sibling_pairs: Set[Tuple[str, str]] = set()

    def add_parent(parent: str, child: str) -> None:
        if not parent or not child or parent == child:
            return
        parents_of.setdefault(child, set()).add(parent)
        children_of.setdefault(parent, set()).add(child)

    for frm, to, typ in edges:
        kind = (typ or "").lower()
        if kind in ("parent", "child"):
            # Both store the parent first and the child second.
            add_parent(frm, to)
        elif kind == "spouse":
            spouses_of.setdefault(frm, set()).add(to)
            spouses_of.setdefault(to, set()).add(frm)
        elif kind == "sibling" and frm != to:
            sibling_pairs.add(tuple(sorted((frm, to))))

    for kids in children_of.values():
        kid_list = list(kids)
        for i in range(len(kid_list)):
            for j in range(i + 1, len(kid_list)):
                sibling_pairs.add(tuple(sorted((kid_list[i], kid_list[j]))))

    def reaches(start: str, goal: str) -> bool:
        stack = [start]
        seen: Set[str] = set()
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            if current == goal:
                return True
            stack.extend(parents_of.get(current, ()))
        return False

    added: List[Edge] = []
    added_keys: Set[Tuple[str, str]] = set()

    def try_add(parent: str, child: str) -> bool:
        if parent == child:
            return False
        if parent in parents_of.get(child, ()):
            return False
        if reaches(parent, child):
            return False
        key = (parent, child)
        if key in added_keys:
            return False
        add_parent(parent, child)
        added.append((parent, child, "parent"))
        added_keys.add(key)
        return True

    guard = 0
    changed = True
    while changed and guard < 12:
        changed = False
        guard += 1
        for left, right in list(sibling_pairs):
            left_parents = parents_of.get(left, set())
            right_parents = parents_of.get(right, set())
            if left_parents and not right_parents:
                for parent in list(left_parents):
                    if try_add(parent, right):
                        changed = True
            elif right_parents and not left_parents:
                for parent in list(right_parents):
                    if try_add(parent, left):
                        changed = True
        for kids in list(children_of.values()):
            kid_list = list(kids)
            for i in range(len(kid_list)):
                for j in range(i + 1, len(kid_list)):
                    sibling_pairs.add(tuple(sorted((kid_list[i], kid_list[j]))))
        for child, parents in list(parents_of.items()):
            if len(parents) != 1:
                continue
            parent = next(iter(parents))
            partners = spouses_of.get(parent, set())
            if len(partners) != 1:
                continue
            partner = next(iter(partners))
            if try_add(partner, child):
                changed = True
    return added
