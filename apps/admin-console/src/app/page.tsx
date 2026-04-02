import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getAdminSession();
  redirect(session ? "/clients" : "/sign-in");
}
