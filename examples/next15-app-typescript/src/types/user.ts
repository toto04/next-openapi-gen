export enum ROLE {
  OWNER,
  MEMBER,
}

// Define path parameter type
export type UserIdParam = {
  id: string; // User's unique identifier
};

export type UserAddress = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
};

// Define response type
export type UserResponse = {
  id: string; // User's unique identifier
  name: string; // User's full name
  email: string; // User's email address
  role: string; // User's role in the system
  address: UserAddress;
};
