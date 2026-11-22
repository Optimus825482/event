import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/features/auth/errors";
import {
  authorize,
  can,
  MODULES,
  VERBS,
  type Module,
  type PolicyActor,
} from "@/features/auth/policy";
import { ROLES, type Role } from "@/features/auth/roles";

// Verb string notation: v=view c=create e=edit d=delete, "-" = denied.
// Expected values are written by hand from the rules, resource omitted.
// Ownership-gated cells (leader/reviews, venue_owner/venues) are given for
// the no-resource case: leader reviews is fully denied, venue_owner venues is "vc--".
const ALL = "vced";
const NONE = "----";
type Row = Record<Module, string>;

const row = (overrides: Partial<Row>): Row => ({
  users: NONE, settings: NONE, events: NONE, venues: NONE, staff: NONE,
  customers: NONE, invitations: NONE, reservations: NONE, check_in: NONE,
  reviews: NONE, notifications: NONE,
  ...overrides,
});

const EXPECTED: Record<Role, Row> = {
  admin: row({
    users: ALL, settings: ALL, events: ALL, venues: ALL, staff: ALL,
    customers: ALL, invitations: ALL, reservations: ALL, check_in: ALL,
    reviews: ALL, notifications: ALL,
  }),
  organizer: row({
    events: ALL, venues: ALL, staff: ALL, customers: ALL, invitations: ALL,
    reservations: ALL, check_in: ALL, reviews: ALL, notifications: ALL,
  }),
  staff: row({ reservations: "vce-", customers: "v---", check_in: "vc--" }),
  leader: row({ check_in: "vc--", reviews: NONE, notifications: "v---" }),
  controller: row({ check_in: "vc--" }),
  venue_owner: row({ venues: "vc--" }),
};

const VERB_CHARS = { view: "v", create: "c", edit: "e", delete: "d" } as const;

const actorFor = (role: Role, over: Partial<PolicyActor> = {}): PolicyActor => ({
  id: "u1",
  role,
  staffId: role === "leader" ? "s1" : null,
  ...over,
});

describe("policy matrix", () => {
  it("covers 6 roles x 11 modules x 4 verbs", () => {
    expect(ROLES.length * MODULES.length * VERBS.length).toBe(264);
  });

  for (const role of ROLES) {
    for (const mod of MODULES) {
      for (const verb of VERBS) {
        const expected = EXPECTED[role][mod].includes(VERB_CHARS[verb]);
        it(`${role} ${mod} ${verb} -> ${expected}`, () => {
          expect(can(actorFor(role), mod, verb)).toBe(expected);
        });
      }
    }
  }
});

describe("ownership", () => {
  it("leader can edit own team's review, not another team's", () => {
    const leader = actorFor("leader");
    expect(can(leader, "reviews", "edit", { teamLeaderStaffId: "s1" })).toBe(true);
    expect(can(leader, "reviews", "edit", { teamLeaderStaffId: "s2" })).toBe(false);
    expect(can(leader, "reviews", "view", { teamLeaderStaffId: "s1" })).toBe(true);
    expect(can(leader, "reviews", "create", { teamLeaderStaffId: "s1" })).toBe(true);
    expect(can(leader, "reviews", "delete", { teamLeaderStaffId: "s1" })).toBe(false);
  });

  it("leader without a staffId is always denied on reviews", () => {
    const leader = actorFor("leader", { staffId: null });
    expect(can(leader, "reviews", "view", {})).toBe(false);
    expect(can(leader, "reviews", "edit", { teamLeaderStaffId: "s1" })).toBe(false);
  });

  it("leader without resource is denied on reviews", () => {
    for (const verb of VERBS) {
      expect(can(actorFor("leader"), "reviews", verb)).toBe(false);
    }
  });

  it("venue_owner cannot delete or edit someone else's venue", () => {
    const owner = actorFor("venue_owner");
    expect(can(owner, "venues", "delete", { ownerId: "u2" })).toBe(false);
    expect(can(owner, "venues", "edit", { ownerId: "u2" })).toBe(false);
    expect(can(owner, "venues", "delete", { ownerId: "u1" })).toBe(true);
    expect(can(owner, "venues", "edit", { ownerId: "u1" })).toBe(true);
    expect(can(owner, "venues", "edit")).toBe(false);
    expect(can(owner, "venues", "delete")).toBe(false);
  });

  it("venue_owner view with a resource must be owned", () => {
    const owner = actorFor("venue_owner");
    expect(can(owner, "venues", "view", { ownerId: "u1" })).toBe(true);
    expect(can(owner, "venues", "view", { ownerId: "u2" })).toBe(false);
    expect(can(owner, "venues", "view")).toBe(true);
    expect(can(owner, "venues", "create")).toBe(true);
  });

  it("organizer and admin ignore ownership", () => {
    const res = { ownerId: "other", teamLeaderStaffId: "other" };
    expect(can(actorFor("organizer"), "venues", "delete", res)).toBe(true);
    expect(can(actorFor("organizer"), "reviews", "edit", res)).toBe(true);
    expect(can(actorFor("admin"), "venues", "delete", res)).toBe(true);
    expect(can(actorFor("admin"), "reviews", "edit", res)).toBe(true);
  });
});

describe("permission rows", () => {
  const row = (module: Module, flags: Partial<Record<"canView" | "canCreate" | "canEdit" | "canDelete", boolean>>) => ({
    module, canView: true, canCreate: true, canEdit: true, canDelete: true, ...flags,
  });

  it("organizer row with canDelete=false closes delete only", () => {
    const org = actorFor("organizer", { permissions: [row("events", { canDelete: false })] });
    expect(can(org, "events", "delete")).toBe(false);
    expect(can(org, "events", "edit")).toBe(true);
    expect(can(org, "venues", "delete")).toBe(true);
  });

  it("staff row never opens access", () => {
    const staff = actorFor("staff", { permissions: [row("events", {})] });
    expect(can(staff, "events", "view")).toBe(false);
    expect(can(staff, "customers", "create")).toBe(false);
  });

  it("rows do not apply to admin", () => {
    const admin = actorFor("admin", {
      permissions: [row("events", { canView: false, canCreate: false, canEdit: false, canDelete: false })],
    });
    for (const verb of VERBS) expect(can(admin, "events", verb)).toBe(true);
  });

  it("module without a row keeps the baseline", () => {
    const staff = actorFor("staff", { permissions: [row("customers", { canView: false })] });
    expect(can(staff, "customers", "view")).toBe(false);
    expect(can(staff, "reservations", "edit")).toBe(true);
  });

  it("duplicate rows must all allow", () => {
    const org = actorFor("organizer", {
      permissions: [row("events", {}), row("events", { canEdit: false })],
    });
    expect(can(org, "events", "edit")).toBe(false);
    expect(can(org, "events", "view")).toBe(true);
  });

  it("rows also narrow ownership-gated roles", () => {
    const owner = actorFor("venue_owner", { permissions: [row("venues", { canCreate: false })] });
    expect(can(owner, "venues", "create")).toBe(false);
    expect(can(owner, "venues", "view")).toBe(true);
  });
});

describe("authorize", () => {
  it("throws ForbiddenError when denied", () => {
    expect(() => authorize(actorFor("staff"), "users", "view")).toThrow(ForbiddenError);
  });

  it("returns undefined when allowed", () => {
    expect(authorize(actorFor("admin"), "users", "view")).toBeUndefined();
  });
});
