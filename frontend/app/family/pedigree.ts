export type PedigreeEdge = {
  from_person_id: string;
  to_person_id: string;
  type: string;
};

export type CoupleUnit = {
  id: string;
  personId: string;
  spouses: string[];
  members: string[];
};

export type PedigreeLink = {
  parentId: string;
  childId: string;
  /** The child the line should land on, so a couple can belong to two families. */
  childPersonId: string;
};

export type Pedigree = {
  parentsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
  siblingsOf: Map<string, string[]>;
  /** Oldest generation first. Everyone in a row is the same generation. */
  generations: CoupleUnit[][];
  links: PedigreeLink[];
  /** Parentless sibling households that should share a bar. */
  siblingBars: string[][];
  placed: Set<string>;
};

function addLink(map: Map<string, string[]>, a: string, b: string): boolean {
  const list = map.get(a) || [];
  if (list.includes(b)) return false;
  list.push(b);
  map.set(a, list);
  return true;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function buildPedigree(personIds: string[], relationships: PedigreeEdge[]): Pedigree {
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();
  const siblingsOf = new Map<string, string[]>();

  for (const rel of relationships) {
    const from = rel.from_person_id;
    const to = rel.to_person_id;
    if (rel.type === "parent") {
      addLink(parentsOf, to, from);
      addLink(childrenOf, from, to);
    } else if (rel.type === "spouse") {
      addLink(spousesOf, from, to);
      addLink(spousesOf, to, from);
    } else if (rel.type === "sibling") {
      addLink(siblingsOf, from, to);
      addLink(siblingsOf, to, from);
    }
  }

  for (const kids of childrenOf.values()) {
    for (let i = 0; i < kids.length; i += 1) {
      for (let j = i + 1; j < kids.length; j += 1) {
        addLink(siblingsOf, kids[i], kids[j]);
        addLink(siblingsOf, kids[j], kids[i]);
      }
    }
  }

  for (const parents of parentsOf.values()) {
    if (parents.length === 2) {
      addLink(spousesOf, parents[0], parents[1]);
      addLink(spousesOf, parents[1], parents[0]);
    }
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < personIds.length + 2) {
    changed = false;
    guard += 1;
    for (const [personId, siblings] of siblingsOf) {
      const ownParents = parentsOf.get(personId) || [];
      if (ownParents.length > 0) continue;
      const donor = siblings.find((siblingId) => (parentsOf.get(siblingId) || []).length > 0);
      if (!donor) continue;
      for (const parentId of parentsOf.get(donor) || []) {
        const addedParent = addLink(parentsOf, personId, parentId);
        const addedChild = addLink(childrenOf, parentId, personId);
        if (addedParent || addedChild) changed = true;
      }
    }
  }

  const connected = new Set<string>();
  const touch = (ids: string[]) => {
    for (const id of ids) connected.add(id);
  };
  for (const [personId, parents] of parentsOf) {
    if (parents.length) touch([personId, ...parents]);
  }
  for (const [personId, spouses] of spousesOf) {
    if (spouses.length) touch([personId, ...spouses]);
  }
  for (const [personId, siblings] of siblingsOf) {
    if (siblings.length) touch([personId, ...siblings]);
  }

  const findParent = new Map<string, string>();
  const find = (id: string): string => {
    let current = id;
    while (findParent.get(current) !== current) {
      const next = findParent.get(current);
      if (!next) break;
      current = next;
    }
    findParent.set(id, current);
    return current;
  };
  const unite = (a: string, b: string) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) findParent.set(left, right);
  };
  for (const id of personIds) {
    if (connected.has(id)) findParent.set(id, id);
  }
  for (const [personId, spouses] of spousesOf) {
    for (const spouseId of spouses) {
      if (connected.has(personId) && connected.has(spouseId)) unite(personId, spouseId);
    }
  }

  const groups = new Map<string, string[]>();
  for (const id of connected) {
    const root = find(id);
    const list = groups.get(root) || [];
    list.push(id);
    groups.set(root, list);
  }

  const units: CoupleUnit[] = [];
  const unitOf = new Map<string, string>();
  for (const members of groups.values()) {
    const anchor = [...members].sort((a, b) => {
      const weight = (id: string) =>
        (parentsOf.get(id)?.length || 0) + (childrenOf.get(id)?.length || 0);
      return weight(b) - weight(a) || a.localeCompare(b);
    })[0];
    const spouses = members.filter((id) => id !== anchor).sort((a, b) => a.localeCompare(b));
    units.push({ id: anchor, personId: anchor, spouses, members: [anchor, ...spouses] });
    for (const member of members) unitOf.set(member, anchor);
  }

  const parentUnits = new Map<string, string[]>();
  const childUnits = new Map<string, string[]>();
  for (const unit of units) {
    const parents = unique(
      unit.members.flatMap((member) =>
        (parentsOf.get(member) || [])
          .map((parentId) => unitOf.get(parentId))
          .filter((parentUnit): parentUnit is string => !!parentUnit && parentUnit !== unit.id)
      )
    );
    parentUnits.set(unit.id, parents);
    for (const parentId of parents) addLink(childUnits, parentId, unit.id);
  }

  const generationOf = new Map<string, number>();
  const visiting = new Set<string>();
  const generation = (unitId: string): number => {
    const known = generationOf.get(unitId);
    if (known != null) return known;
    if (visiting.has(unitId)) return 0;
    visiting.add(unitId);
    const parents = parentUnits.get(unitId) || [];
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(generation));
    visiting.delete(unitId);
    generationOf.set(unitId, value);
    return value;
  };

  const rows: CoupleUnit[][] = [];
  for (const unit of units) {
    const row = generation(unit.id);
    while (rows.length <= row) rows.push([]);
    rows[row].push(unit);
  }

  const slot = new Map<string, number>();
  if (rows[0]) {
    rows[0].sort((a, b) => householdKey(a).localeCompare(householdKey(b)) || a.id.localeCompare(b.id));
    rows[0].forEach((unit, index) => slot.set(unit.id, index));
  }
  for (let row = 1; row < rows.length; row += 1) {
    rows[row].sort((a, b) => {
      const place = (unit: CoupleUnit) => {
        const parents = parentUnits.get(unit.id) || [];
        if (!parents.length) return 0;
        const sum = parents.reduce((total, parentId) => total + (slot.get(parentId) ?? 0), 0);
        return sum / parents.length;
      };
      return place(a) - place(b) || a.id.localeCompare(b.id);
    });
    rows[row].forEach((unit, index) => slot.set(unit.id, index));
  }

  for (const unit of units) {
    const side = (personId: string) => {
      const sides = (parentsOf.get(personId) || [])
        .map((parentId) => slot.get(unitOf.get(parentId) || ""))
        .filter((value): value is number => value != null);
      if (!sides.length) return slot.get(unit.id) ?? 0;
      return sides.reduce((total, value) => total + value, 0) / sides.length;
    };
    const ordered = [...unit.members].sort((a, b) => side(a) - side(b) || a.localeCompare(b));
    unit.members = ordered;
    unit.personId = ordered[0];
    unit.spouses = ordered.slice(1);
  }

  function householdKey(unit: CoupleUnit): string {
    const kin = new Set<string>([unit.id]);
    for (const member of unit.members) {
      for (const siblingId of siblingsOf.get(member) || []) {
        const siblingUnit = unitOf.get(siblingId);
        if (siblingUnit) kin.add(siblingUnit);
      }
    }
    return [...kin].sort()[0];
  }

  const links: PedigreeLink[] = [];
  const seenLinks = new Set<string>();
  for (const unit of units) {
    for (const member of unit.members) {
      for (const parentPersonId of parentsOf.get(member) || []) {
        const parentId = unitOf.get(parentPersonId);
        if (!parentId || parentId === unit.id) continue;
        const key = `${parentId}|${member}`;
        if (seenLinks.has(key)) continue;
        seenLinks.add(key);
        links.push({ parentId, childId: unit.id, childPersonId: member });
      }
    }
  }

  const barParent = new Map<string, string>();
  const barFind = (id: string): string => {
    let current = id;
    while (barParent.get(current) !== current) {
      const next = barParent.get(current);
      if (!next) break;
      current = next;
    }
    barParent.set(id, current);
    return current;
  };
  for (const unit of units) {
    if ((parentUnits.get(unit.id) || []).length === 0) barParent.set(unit.id, unit.id);
  }
  for (const unit of units) {
    if ((parentUnits.get(unit.id) || []).length > 0) continue;
    for (const member of unit.members) {
      for (const siblingId of siblingsOf.get(member) || []) {
        const siblingUnit = unitOf.get(siblingId);
        if (!siblingUnit || siblingUnit === unit.id) continue;
        if ((parentUnits.get(siblingUnit) || []).length > 0) continue;
        const left = barFind(unit.id);
        const right = barFind(siblingUnit);
        if (left !== right) barParent.set(left, right);
      }
    }
  }
  const barGroups = new Map<string, string[]>();
  for (const unitId of barParent.keys()) {
    const root = barFind(unitId);
    const list = barGroups.get(root) || [];
    list.push(unitId);
    barGroups.set(root, list);
  }
  const siblingBars = [...barGroups.values()].filter((group) => group.length > 1);

  return {
    parentsOf,
    childrenOf,
    spousesOf,
    siblingsOf,
    generations: rows,
    links,
    siblingBars,
    placed: connected,
  };
}
