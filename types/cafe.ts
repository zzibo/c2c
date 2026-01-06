export interface Coordinate {
  lat: number;
  lng: number;
}

export interface OpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface CafeRatings {
  coffee: number;
  vibe: number;
  wifi: number;
  outlets: number;
  seating: number;
  noise: number;
  overall: number;
  // Legacy fields for backwards compatibility
  infra?: number;
  value?: number;
  workFriendliness?: number;
  food?: number;
}

export interface Cafe {
  id: string;  // Database UUID (preferred) or geoapify_place_id (legacy)
  geoapifyPlaceId?: string;  // External Geoapify reference
  name: string;
  location: Coordinate;
  address: string;
  placeId: string;  // Deprecated - use geoapifyPlaceId

  ratings: CafeRatings;
  totalReviews: number;
  photos: string[];

  hours?: OpeningHours;
  phoneNumber?: string;
  website?: string;
  priceLevel?: number; // 1-4 ($-$$$$)
  distance?: number; // meters from user
}

export interface CafeRating {
  id: string;
  cafeId: string;
  userId: string;
  timestamp: Date;

  coffeeScore: number; // 1-5
  vibeScore: number;
  infraScore: number;
  valueScore?: number;
  workFriendlinessScore?: number;
  foodScore?: number;

  reviewText?: string;
  photos: string[];
  wifiSpeed?: number; // Mbps
  visitDuration?: number;

  helpfulCount: number;
  isVerifiedVisit: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar?: string;

  preferredCoffeeType: string[];
  noisePreference: 'quiet' | 'moderate' | 'lively';
  wifiImportance: number; // 1-5
  savedCafes: string[];
  recentSearches: string[];

  ratingsCount: number;
  reputationScore: number;
}

export interface Rating {
  id: string;
  cafe_id: string;
  user_id: string;
  coffee_rating: number | null;
  vibe_rating: number | null;
  wifi_rating: number | null;
  outlets_rating: number | null;
  seating_rating: number | null;
  noise_rating: number | null;
  overall_rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface RatingWithUser extends Rating {
  username: string;
}
