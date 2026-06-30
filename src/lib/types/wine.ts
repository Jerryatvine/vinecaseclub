export type Wine = {
  id: string;
  name: string;
  winery: string;
  vintage?: number;
  image_url?: string;
  inventory?: number;
  msrp?: number;
  store_price?: number;
  club_price?: number;
  available_for_club?: boolean;
  varietal?: string;
  region?: string;
  type?: "red" | "white" | "rosé" | "sparkling" | "dessert" | "orange";
};