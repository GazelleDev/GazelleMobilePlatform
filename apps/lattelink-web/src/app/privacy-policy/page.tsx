import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/About";
import { Nav } from "@/components/Nav";
import { contactEmail, privacyPolicyPath, privacyPolicyUrl, siteName } from "@/lib/site";

const lastUpdated = "April 9, 2026";

const sections = [
  {
    title: "What this policy covers",
    body: [
      `${siteName} provides branded ordering, loyalty, and customer-account tools for independent coffee shops. This policy explains how we collect, use, and share personal information when someone visits our website, submits a contact request, or uses a mobile ordering experience powered by ${siteName}.`,
      `When a coffee shop uses ${siteName}, we may process information on behalf of that coffee shop so customers can sign in, place orders, earn rewards, receive notifications, and manage their account.`
    ]
  },
  {
    title: "Information we collect",
    body: [
      "Account and profile details, such as name, email address, phone number, birthday, and sign-in method.",
      "Order and loyalty data, such as items ordered, pickup timing, rewards balances, reward activity, and order history.",
      "Device and app information, such as push notification tokens, device identifiers needed for notifications, and technical session data.",
      "Payment and transaction information, such as payment status, payment tokens supplied by Apple Pay or other payment providers, transaction IDs, and refund records. We do not intend to store full payment card numbers in our ordering backend.",
      "Website contact information, such as the details you submit through the LatteLink website contact form.",
      "Website analytics information, such as page visits and interaction events on the LatteLink marketing site when analytics is enabled."
    ]
  },
  {
    title: "How we use information",
    body: [
      "To create and secure customer accounts.",
      "To process orders, loyalty activity, refunds, and account support requests.",
      "To send important account or order messages, including push notifications when enabled.",
      "To operate, monitor, and improve the LatteLink platform and its reliability.",
      "To respond to sales or pilot-intro inquiries submitted through the LatteLink website.",
      "To meet legal, security, fraud-prevention, bookkeeping, and compliance obligations."
    ]
  },
  {
    title: "How information may be shared",
    body: [
      "With the coffee shop operating the branded experience you are using.",
      "With service providers that help us host the product, deliver email, support analytics, or process payments.",
      "With payment providers involved in completing a transaction, such as Apple Pay wallet processing and downstream payment processors.",
      "When required by law, legal process, or a valid request from regulators or courts.",
      "As part of a business transfer if LatteLink is reorganized, acquired, or sells assets, subject to applicable law."
    ]
  },
  {
    title: "Retention",
    body: [
      "We keep information for as long as it is reasonably needed to operate the service, maintain records, resolve disputes, prevent fraud, and satisfy legal obligations.",
      "If you delete your account from the mobile app, we aim to remove the customer account data tied to that account from our active systems, subject to any records we must retain for legal, tax, fraud-prevention, or accounting reasons."
    ]
  },
  {
    title: "Your choices",
    body: [
      "You can manage or update profile details from the app where available.",
      "You can disable notifications at the device level.",
      "You can delete your account from the app settings. If you signed in with Apple, we also attempt to revoke the linked Sign in with Apple token during deletion.",
      "You can contact us to ask privacy questions or request help regarding your data."
    ]
  },
  {
    title: "Children",
    body: [
      `${siteName} is not intended for children under 13, and we do not intend to knowingly collect personal information from children under 13.`
    ]
  },
  {
    title: "Changes to this policy",
    body: [
      "We may update this privacy policy from time to time. When we do, we will update the date at the top of this page and post the revised version at this same URL."
    ]
  }
];

export const metadata: Metadata = {
  title: `Privacy Policy | ${siteName}`,
  description: `Privacy Policy for ${siteName} and LatteLink-powered ordering experiences.`,
  alternates: {
    canonical: privacyPolicyPath
  },
  openGraph: {
    title: `Privacy Policy | ${siteName}`,
    description: `Privacy Policy for ${siteName} and LatteLink-powered ordering experiences.`,
    url: privacyPolicyUrl
  }
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <Nav />
      <main style={{ padding: "120px 0 96px", position: "relative", zIndex: 1 }}>
        <style>{`
          .legal-shell {
            width: min(880px, calc(100% - 48px));
            margin: 0 auto;
          }
          .legal-card {
            background: linear-gradient(180deg, rgba(17,19,32,0.96), rgba(9,9,15,0.98));
            border: 1px solid rgba(74,126,255,0.16);
            border-radius: 32px;
            padding: 48px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
          }
          .legal-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid rgba(74,126,255,0.2);
            background: rgba(74,126,255,0.08);
            color: var(--color-blue-300);
            font-size: 12px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }
          .legal-title {
            margin-top: 22px;
            font-family: var(--font-display);
            font-size: clamp(34px, 6vw, 60px);
            line-height: 0.98;
            letter-spacing: -0.04em;
            color: var(--color-gray-100);
          }
          .legal-subtitle {
            margin-top: 18px;
            font-size: 16px;
            line-height: 1.8;
            color: var(--color-gray-400);
            max-width: 680px;
          }
          .legal-meta {
            margin-top: 18px;
            color: var(--color-gray-500);
            font-size: 13px;
            letter-spacing: 0.02em;
          }
          .legal-sections {
            margin-top: 42px;
            display: grid;
            gap: 18px;
          }
          .legal-section {
            border: 1px solid var(--color-border);
            border-radius: 24px;
            background: rgba(17,19,32,0.72);
            padding: 28px 28px 26px;
          }
          .legal-section h2 {
            font-family: var(--font-display);
            font-size: 24px;
            line-height: 1.15;
            letter-spacing: -0.03em;
            color: var(--color-gray-100);
          }
          .legal-section p,
          .legal-section li {
            font-size: 15px;
            line-height: 1.8;
            color: var(--color-gray-300);
          }
          .legal-section ul {
            margin-top: 14px;
            padding-left: 20px;
            display: grid;
            gap: 10px;
          }
          .legal-section p + p {
            margin-top: 12px;
          }
          .legal-contact {
            margin-top: 28px;
            padding: 22px 24px;
            border-radius: 22px;
            border: 1px solid rgba(74,126,255,0.18);
            background: rgba(74,126,255,0.06);
          }
          .legal-contact a,
          .legal-home-link {
            color: var(--color-blue-300);
            text-decoration: none;
          }
          .legal-home-link:hover,
          .legal-contact a:hover {
            color: var(--color-gray-100);
          }
          @media (max-width: 720px) {
            .legal-card {
              padding: 32px 22px;
              border-radius: 24px;
            }
            .legal-section {
              padding: 22px 18px;
              border-radius: 18px;
            }
          }
        `}</style>

        <div className="legal-shell">
          <div className="legal-card">
            <div className="legal-kicker">Privacy Policy</div>
            <h1 className="legal-title">Privacy for LatteLink-powered ordering.</h1>
            <p className="legal-subtitle">
              This page explains what information LatteLink may collect, how it is used, and what choices people have
              when they use the LatteLink website or a branded mobile ordering experience powered by LatteLink.
            </p>
            <div className="legal-meta">Last updated {lastUpdated}</div>

            <div className="legal-sections">
              {sections.map((section) => (
                <section key={section.title} className="legal-section">
                  <h2>{section.title}</h2>
                  {section.body.length === 1 ? (
                    <p style={{ marginTop: 14 }}>{section.body[0]}</p>
                  ) : section.title === "Information we collect" ||
                    section.title === "How we use information" ||
                    section.title === "How information may be shared" ||
                    section.title === "Your choices" ? (
                    <ul>
                      {section.body.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      {section.body.map((entry) => (
                        <p key={entry} style={{ marginTop: 14 }}>
                          {entry}
                        </p>
                      ))}
                    </>
                  )}
                </section>
              ))}
            </div>

            <div className="legal-contact">
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--color-gray-300)" }}>
                Questions about this policy can be sent to{" "}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. You can also return to the{" "}
                <Link href="/" className="legal-home-link">
                  LatteLink homepage
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
