import type { Role } from "@/lib/rbac";

declare module "@auth/core/types" {
  interface User {
    role: Role;
    businessId: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      businessId: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    businessId: string;
    uid: string;
  }
}
