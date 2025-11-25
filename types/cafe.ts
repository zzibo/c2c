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
  id: string;
  name: string;
  location: Coordinate;
  address: string;
  placeId: string;

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
