import { buildPedigree } from "./pedigree.ts";

function edge(from, type, to) {
  return { from_person_id: from, to_person_id: to, type };
}

function unitOf(tree, id) {
  return tree.generations.flat().find((unit) => unit.members.includes(id));
}

function generationOf(tree, id) {
  return tree.generations.findIndex((row) => row.some((unit) => unit.members.includes(id)));
}

const people = [
  "mohinder",
  "balbir",
  "gurpreet",
  "simran",
  "her-father",
  "her-mother",
  "aman",
  "ajai",
];
const edges = [
  edge("mohinder", "parent", "gurpreet"),
  edge("balbir", "parent", "gurpreet"),
  edge("gurpreet", "spouse", "simran"),
  edge("her-father", "parent", "simran"),
  edge("her-mother", "parent", "simran"),
  edge("gurpreet", "parent", "aman"),
  edge("gurpreet", "sibling", "ajai"),
];

const tree = buildPedigree(people, edges);
for (const name of people) {
  if (!unitOf(tree, name)) throw new Error(`${name} is missing from the tree`);
}
if (generationOf(tree, "mohinder") !== generationOf(tree, "her-father")) {
  throw new Error("grandparents should share a generation");
}
if (generationOf(tree, "gurpreet") !== generationOf(tree, "ajai")) {
  throw new Error("a sibling should sit beside their brother, not under him");
}
if (generationOf(tree, "aman") !== generationOf(tree, "gurpreet") + 1) {
  throw new Error("children should be the next generation");
}
if (unitOf(tree, "gurpreet") !== unitOf(tree, "simran")) {
  throw new Error("spouses should share a box");
}
if (unitOf(tree, "mohinder") !== unitOf(tree, "balbir")) {
  throw new Error("the two grandparents should share a box");
}

const singh = buildPedigree(
  [
    "mohinder",
    "balbir",
    "gurpreet",
    "simran",
    "jasbir",
    "harjit",
    "manpreet",
    "ravi",
    "parkash",
    "tejinder",
    "aman",
    "navneet",
    "rohan",
    "ajai",
  ],
  [
    edge("mohinder", "parent", "gurpreet"),
    edge("balbir", "parent", "gurpreet"),
    edge("gurpreet", "spouse", "simran"),
    edge("gurpreet", "parent", "aman"),
    edge("gurpreet", "parent", "navneet"),
    edge("gurpreet", "parent", "rohan"),
    edge("gurpreet", "sibling", "ajai"),
    edge("gurpreet", "sibling", "jasbir"),
    edge("gurpreet", "sibling", "manpreet"),
    edge("jasbir", "spouse", "harjit"),
    edge("manpreet", "spouse", "ravi"),
    edge("parkash", "parent", "simran"),
    edge("parkash", "parent", "tejinder"),
  ]
);
const grandparentRow = generationOf(singh, "parkash");
for (const name of ["parkash", "mohinder", "balbir"]) {
  if (generationOf(singh, name) !== grandparentRow) {
    throw new Error(`${name} should be on the grandparent row`);
  }
}
const parentRow = generationOf(singh, "gurpreet");
for (const name of ["tejinder", "simran", "gurpreet", "jasbir", "harjit", "manpreet", "ravi", "ajai"]) {
  if (generationOf(singh, name) !== parentRow) {
    throw new Error(`${name} should sit on the same row as Gurpreet`);
  }
}
if (parentRow !== grandparentRow + 1) throw new Error("parents should be directly under the grandparents");
for (const name of ["aman", "navneet", "rohan"]) {
  if (generationOf(singh, name) !== parentRow + 1) {
    throw new Error(`${name} should be on the child row`);
  }
}
if (unitOf(singh, "jasbir") !== unitOf(singh, "harjit")) {
  throw new Error("Harjit should share Jasbir's box");
}
if (unitOf(singh, "manpreet") !== unitOf(singh, "ravi")) {
  throw new Error("Ravi should share Manpreet's box");
}
const childOf = (parent, child) =>
  singh.links.some((link) => link.parentId === unitOf(singh, parent).id && link.childPersonId === child);
if (!childOf("parkash", "simran") || !childOf("parkash", "tejinder")) {
  throw new Error("Nani's line should land on Simran and Tejinder");
}
if (childOf("parkash", "gurpreet") || childOf("parkash", "jasbir")) {
  throw new Error("Nani's line should not cover Dada's children");
}
if (!childOf("mohinder", "gurpreet") || !childOf("mohinder", "jasbir")) {
  throw new Error("Dada's line should land on Gurpreet and Jasbir");
}
if (childOf("mohinder", "simran") || childOf("mohinder", "tejinder")) {
  throw new Error("Dada's line should not cover Nani's children");
}
const couple = unitOf(singh, "gurpreet");
const dadaSide = singh.generations[0].findIndex((unit) => unit.members.includes("mohinder"));
const naniSide = singh.generations[0].findIndex((unit) => unit.members.includes("parkash"));
const gurpreetFirst = couple.members.indexOf("gurpreet") < couple.members.indexOf("simran");
if (dadaSide < naniSide && !gurpreetFirst) {
  throw new Error("Gurpreet should sit on Dadi and Dada's side of the box");
}
if (naniSide < dadaSide && gurpreetFirst) {
  throw new Error("Simran should sit on Nani's side of the box");
}

const married = buildPedigree(
  ["mohinder", "jasbir", "harjit", "stranger"],
  [edge("mohinder", "parent", "jasbir"), edge("jasbir", "spouse", "harjit")]
);
if (married.placed.has("stranger")) throw new Error("an unlinked person should stay off the tree");
if (unitOf(married, "jasbir") !== unitOf(married, "harjit")) {
  throw new Error("Harjit should share Jasbir's box");
}
if (generationOf(married, "harjit") !== generationOf(married, "jasbir")) {
  throw new Error("Harjit should not start her own row");
}
console.log("ok pedigree");
