import { base44 } from "@/api/base44Client";

export async function getUserRatings(email: string) {
  return base44.entities.WineRating.filter({
    member_email: email,
  });
}

export async function saveWineRating(data: any) {
  return base44.entities.WineRating.create(data);
}

export async function updateWineRating(id: string, data: any) {
  return base44.entities.WineRating.update(id, data);
}