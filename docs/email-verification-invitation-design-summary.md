# Email Verification & Organization Invitation — Summary (Sanitized)

This is a concise, safe summary of the email verification and organization invitation design. All secrets have been removed. If you see any real credentials still in your repo (for example `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`), replace them with placeholders and store them securely.

## Quick configuration (env vars)

- EMAIL_ENABLED=true
- EMAIL_PROVIDER=aws_ses | smtp | console
- EMAIL_FROM_ADDRESS=noreply@your-domain.com
- EMAIL_FROM_NAME="MCP Gateway"

AWS SES (use secrets manager / environment / IAM roles — never commit keys)
- AWS_REGION=us-east-2
- AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>
- AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY>
- AWS_SES_CONFIGURATION_SET=<optional configuration set>
- AWS_SES_MAX_SEND_RATE=14

SMTP (legacy)
- SMTP_HOST=smtp.example.com
- SMTP_PORT=587
- SMTP_USERNAME=<SMTP_USERNAME>
- SMTP_PASSWORD=<SMTP_PASSWORD>
- SMTP_USE_TLS=true

Token expirations (hours)
- EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS=24
- ORG_INVITATION_TOKEN_EXPIRE_HOURS=72


## High-level flow

- Registration creates a user with `email_verified=false` and generates a verification token (single-use, expires in 24h).
- A verification email is sent (via SES or SMTP). User clicks link -> calls verify endpoint -> token validated -> sets `email_verified=true`.
- Org admins can invite users; invites create an `invitation` record with expiry (72h). If invited user exists but is unverified the system creates both an invitation and a verification token and sends a combined email.


## Database highlights

- `user` table: includes `email_verified BOOLEAN DEFAULT FALSE`.
- `verification` table: stores hashed token values, identifier (email), expires_at, timestamps.
- `invitation` table: stores email, organization_id, inviter_id, role, status, expires_at, timestamps.
- `email_suppression_list` table: store bounces/complaints to avoid re-sending.


## Token & security

- Generate tokens with `secrets.token_urlsafe(32)`.
- Hash tokens before storing using HMAC-SHA256 (or SHA256 with a server secret). Never store raw tokens.
- Tokens are single-use; delete or mark them used after successful validation.
- Validate expiry and metadata on every token use.
- Rate limits: max 3 verification emails/hour/user; max 10 invites/hour/org.


## API endpoints (essential)

- POST /auth/register/email — creates user, generates token, sends verification email.
- POST /auth/verify-email — accepts token (and email), validates and marks user verified.
- POST /auth/resend-verification — resend verification email for authenticated users (rate-limited).
- POST /organizations/{org_id}/invite — send invitation.
- GET /invitations/info?token=... — public lookup for invitation details.
- POST /invitations/accept — accept invitation (auth required for existing users).


## SES / Sending best-practices

- Verify domain and set DKIM/SPF/DMARC.
- Request production access (remove sandbox restrictions).
- Set up SNS topics for bounce/complaint notifications and maintain a suppression list.
- Include both HTML and plain-text email bodies, an unsubscribe link (when appropriate), and test templates across clients.
- Implement retry logic with exponential backoff for transient failures.


## Monitoring & alerts

- CloudWatch metrics: EmailSent, EmailFailed, BounceRate, ComplaintRate.
- Alerts: bounce rate > 5%, complaint rate > 0.1%, send quota > 80%, failed email rate > 1%.


## Short checklist before production

- Domain DKIM/SPF/DMARC verified
- SES out of sandbox
- SNS topics for bounces/complaints configured
- Suppression list in DB
- Retry and rate-limiting implemented
- Templates tested
- Secrets moved to Secrets Manager / environment or use IAM roles


## Security note about leaked credentials

If any AWS keys or other credentials were accidentally included in your docs or repo, rotate them immediately. Do not commit secrets to source control. Use one of these secure options:

- AWS IAM roles attached to EC2/ECS/Lambda (preferred for AWS infra)
- AWS Secrets Manager or Parameter Store for runtime secrets
- Environment variables injected at deploy time (avoid storing in VCS)

Replace any literal credentials you find (for example air-gapped examples) with placeholders like:

- AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>
- AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY>


## Next steps

1. Rotate any discovered credentials immediately.
2. Move secrets to a secrets manager and update deployments.
3. Implement token hashing and test token lifecycle (unit + integration tests).
4. Add SES SNS handlers for bounces/complaints and wire to suppression list.


---

Prepared a concise, sanitized summary of the design. If you want I can:
- Create a migration SQL for the tables mentioned, or
- Implement the TokenService and a small unit test, or
- Search the repo for any accidentally committed keys and help rotate them.

## Additional security recommendations (brief)

- Immediately rotate any AWS keys or credentials if they were ever committed or displayed in docs.
- Add a pre-commit hook (e.g. git-secrets or detect-secrets) to block accidental commits of secrets.
- Enforce secrets in CI/CD to be pulled from the environment or a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.).
- Use IAM roles instead of long-lived keys for services running in AWS (ECS, Lambda, EC2).
- Log secret-access events and configure alerts around suspicious access patterns.
- Add a short runbook for "compromised key" that includes: revoke key, rotate, inspect audit logs, and communicate to stakeholders.

If you'd like, I can also run a quick repo scan to look for patterns that resemble AWS keys (without exfiltrating any real secrets) and produce a report.
