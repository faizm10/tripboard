import { getNeonAuth } from "@/lib/auth";

type AuthContext = { params: Promise<{ path: string[] }> };

async function handle(method: "GET" | "POST", request: Request, context: AuthContext) {
  const auth = getNeonAuth();
  if (!auth) {
    return Response.json(
      { error: "Sign-in is unavailable right now." },
      { status: 503 },
    );
  }
  return auth.handler()[method](request, context);
}

export function GET(request: Request, context: AuthContext) {
  return handle("GET", request, context);
}

export function POST(request: Request, context: AuthContext) {
  return handle("POST", request, context);
}
