import { redirect } from "next/navigation";

// Middleware handles unauthenticated redirects to /login; signed-in users land on /games.
export default function Home() {
  redirect("/games");
}
