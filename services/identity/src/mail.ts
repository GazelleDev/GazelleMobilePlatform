import type { FastifyBaseLogger } from "fastify";

const defaultMailProvider = "log";
const defaultResendFromAddress = "Gazelle <onboarding@resend.dev>";

export type MailSender = {
  sendMagicLink(params: { to: string; magicLinkUrl: string }): Promise<void>;
};

type CreateMailSenderOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  logger: FastifyBaseLogger;
};

function resolveMailProvider(env: NodeJS.ProcessEnv) {
  return env.MAIL_PROVIDER?.trim().toLowerCase() || defaultMailProvider;
}

export function createMailSender({
  env = process.env,
  fetchImpl = fetch,
  logger
}: CreateMailSenderOptions): MailSender {
  const provider = resolveMailProvider(env);

  if (provider === "log") {
    return {
      async sendMagicLink({ to, magicLinkUrl }) {
        logger.info(
          {
            provider,
            recipient: to,
            magicLinkUrl
          },
          "magic link generated in log mode; no email was sent"
        );
      }
    };
  }

  if (provider === "resend") {
    const apiKey = env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return {
        async sendMagicLink() {
          throw new Error("MAIL_PROVIDER=resend requires RESEND_API_KEY");
        }
      };
    }

    const fromAddress = env.RESEND_FROM_EMAIL?.trim() || defaultResendFromAddress;

    return {
      async sendMagicLink({ to, magicLinkUrl }) {
        const response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject: "Your Gazelle sign-in link",
            html: `<p>Use the link below to sign in:</p><p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>`
          })
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`Resend request failed with ${response.status}: ${responseText}`);
        }
      }
    };
  }

  return {
    async sendMagicLink() {
      throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`);
    }
  };
}
