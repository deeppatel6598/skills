import type { Metadata } from "next";
import { SiteNav } from "../components/SiteNav";
import { ContactForm } from "../components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Paws & Care",
  description: "Get in touch with Paws & Care Veterinary Clinic.",
};

const details = [
  { label: "Address", value: "248 Maple Street, Springfield (free parking behind the building)" },
  { label: "Phone", value: "(555) 248-7297" },
  { label: "Hours", value: "Mon–Fri 8am–6pm · Sat 9am–2pm · Closed Sunday" },
  { label: "Emergency line", value: "(555) 911-PETS" },
];

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Contact
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
            We&apos;d love to hear from you.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            Questions about your pet or your visit? Send us a note — or just ask
            Sofia on the home page and she can book you in right away.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Reach us</h2>
              <dl className="mt-4 space-y-4">
                {details.map((d) => (
                  <div key={d.label} className="rounded-2xl border border-border bg-card p-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                    <dd className="mt-1 text-sm text-card-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Send a message</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
