import { submitApiForm } from "@/lib/builder-api";

export async function POST(request: Request) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData.entries());
  const formTitle = String(entries._formTitle || "Form");

  await submitApiForm(formTitle, entries);

  return new Response("Thanks. Your form submission was received.", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
