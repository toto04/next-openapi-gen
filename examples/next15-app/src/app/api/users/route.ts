enum ROLE {
  OWNER,
  MEMBER,
}

type User = {
  id: number;
  name: string;
  email: string;
  role: ROLE;
  address: Address;
};

type Address = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
};

type UsersParams = {
  search: string; // search by
  role?: ROLE; // filter by role
  page?: number; // page number
};

type UsersResponse = {
  page?: number;
  count?: number;
  data: User[];
};

/**
 * List all users.
 * @params: UsersParams
 * @response: UsersResponse
 */
export async function GET(req: Request) {
  return Response.json({});
}
