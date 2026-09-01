import { NextResponse } from "next/server";
import { searchSuggestions } from "@repo/data";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchSuggestions(query));
}
