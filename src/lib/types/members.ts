export type MemberRole = "admin" | "member";

export type MembershipTier = "economy" | "premium";

export type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: MemberRole;
  membership_tier: MembershipTier;
};