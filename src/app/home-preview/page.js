import { redirect } from "next/navigation";

/** Legacy path — new home is `/`. */
export default function HomePreviewPage() {
  redirect("/");
}
