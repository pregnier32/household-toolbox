import { Resend } from 'resend';
import { supabaseServer } from '@/lib/supabaseServer';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

type WelcomeEmailParams = {
  to: string;
  firstName: string;
};

type WelcomeEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const RECENT_SIGNUP_MS = 7 * 24 * 60 * 60 * 1000;

const defaultWelcomeEmailTemplate: WelcomeEmailTemplate = {
  subject: 'Welcome to Household Toolbox',
  html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Household Toolbox</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; background-color: #f8fafc; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #0f172a; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 600;">
          🧰 Household Toolbox
        </h1>
      </div>

      <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 600;">
          Welcome, \${firstName}.
        </h2>

        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          Your email is confirmed and your account is ready. Household Toolbox is a store of tools for the records a household keeps.
        </p>

        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          Your first two tools are free. Each tool after that is $2 a month.
        </p>

        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          From your dashboard you can:
        </p>

        <ul style="color: #475569; font-size: 16px; margin: 20px 0; padding-left: 20px;">
          <li style="margin: 10px 0;">Add the tools you need for home upkeep, health, money, plans, and records</li>
          <li style="margin: 10px 0;">Pin dates from those tools onto one calendar</li>
          <li style="margin: 10px 0;">Keep photos, scans, and receipts on the record they belong to</li>
          <li style="margin: 10px 0;">Export a PDF when you want a copy</li>
        </ul>

        <div style="margin: 30px 0; text-align: center;">
          <a href="\${appUrl}/dashboard"
             style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Open your dashboard
          </a>
        </div>

        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          <a href="\${appUrl}/tools" style="color: #059669; text-decoration: none;">Browse the tools</a>
        </p>

        <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Questions or help getting started: <a href="\${appUrl}/support" style="color: #059669; text-decoration: none;">\${appUrl}/support</a>
        </p>
      </div>

      <div style="text-align: center; margin-top: 20px; padding: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          © \${year} Household Toolbox. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          The digital toolbox for your whole household.
        </p>
      </div>
    </div>
  </body>
</html>`,
  text: `Welcome to Household Toolbox, \${firstName}.

Your email is confirmed and your account is ready. Household Toolbox is a store of tools for the records a household keeps.

Your first two tools are free. Each tool after that is $2 a month.

Open your dashboard: \${appUrl}/dashboard

From there you can:
- Add the tools you need for home upkeep, health, money, plans, and records
- Pin dates from those tools onto one calendar
- Keep photos, scans, and receipts on the record they belong to
- Export a PDF when you want a copy

Browse the tools: \${appUrl}/tools

Questions or help getting started: \${appUrl}/support

© \${year} Household Toolbox. All rights reserved.
The digital toolbox for your whole household.`,
};

function isWelcomeEmailTemplate(value: unknown): value is WelcomeEmailTemplate {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.subject === 'string' && typeof record.html === 'string' && typeof record.text === 'string';
}

/**
 * Gets the welcome email template from the database or returns default
 */
async function getWelcomeEmailTemplate(): Promise<WelcomeEmailTemplate> {
  try {
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'welcome_email_template')
      .maybeSingle();

    if (!error && isWelcomeEmailTemplate(data?.value)) {
      return data.value;
    }
  } catch (error) {
    console.error('Error fetching welcome email template:', error);
  }

  return defaultWelcomeEmailTemplate;
}

/**
 * Replaces template variables in the email content
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceTemplateVariables(
  template: string,
  firstName: string,
  appUrl: string,
  year: number
): string {
  return template
    .replace(/\$\{firstName\}/g, firstName)
    .replace(/\$\{appUrl\}/g, appUrl)
    .replace(/\$\{year\}/g, year.toString());
}

/**
 * Sends a welcome email to a newly registered user
 */
export async function sendWelcomeEmail({ to, firstName }: WelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  // If Resend API key is not configured, log a warning but don't fail
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Welcome email will not be sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const year = new Date().getFullYear();
    
    // Get the template from database
    const template = await getWelcomeEmailTemplate();
    
    // Replace template variables
    const subject = replaceTemplateVariables(template.subject, firstName, appUrl, year);
    const html = replaceTemplateVariables(template.html, escapeHtml(firstName), appUrl, year);
    const text = replaceTemplateVariables(template.text, firstName, appUrl, year);
    
    console.log(`[Email] Sending welcome email to ${to} from ${fromEmail}`);
    
    const { data, error } = await resend.emails.send({
      from: `Household Toolbox <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text.trim(),
    });

    if (error) {
      console.error('[Email] Error sending welcome email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Welcome email sent successfully! Email ID: ${data?.id || 'N/A'}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

function isRecentSignup(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return !Number.isNaN(created) && Date.now() - created <= RECENT_SIGNUP_MS;
}

async function markWelcomeEmailSent(userId: string): Promise<void> {
  const existing = await supabaseServer.auth.admin.getUserById(userId);
  if (existing.error || !existing.data.user) {
    console.error('Failed to record welcome email', existing.error?.code ?? 'no_user');
    return;
  }

  const updated = await supabaseServer.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(existing.data.user.user_metadata ?? {}),
      welcome_email_sent: true,
    },
  });
  if (updated.error) {
    console.error('Failed to record welcome email', updated.error.code);
  }
}

export async function sendWelcomeEmailForNewUser({
  userId,
  to,
  firstName,
}: WelcomeEmailParams & { userId: string }): Promise<void> {
  try {
    const result = await sendWelcomeEmail({ to, firstName });
    if (!result.success) {
      console.error('Failed to send welcome email', result.error ?? 'unknown');
      return;
    }
    await markWelcomeEmailSent(userId);
  } catch {
    console.error('Failed to send welcome email', userId);
  }
}

export async function sendWelcomeEmailAfterConfirmation(userId: string): Promise<void> {
  const loaded = await supabaseServer.auth.admin.getUserById(userId);
  const authUser = loaded.data.user;
  if (loaded.error || !authUser?.email || !authUser.email_confirmed_at) return;
  if (authUser.user_metadata?.welcome_email_sent === true) return;
  if (!isRecentSignup(authUser.created_at)) return;

  const { data: profile, error } = await supabaseServer
    .from('users')
    .select('first_name, email')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile?.email) {
    console.error('Welcome email skipped, profile missing');
    return;
  }

  await sendWelcomeEmailForNewUser({
    userId,
    to: profile.email,
    firstName: profile.first_name.trim() || 'there',
  });
}

type SupportEmailParams = {
  type: 'question' | 'support' | 'feature' | 'custom_tool';
  name: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Sends a support email to support@householdtoolbox.com
 */
export async function sendSupportEmail({ type, name, email, subject, message }: SupportEmailParams): Promise<{ success: boolean; error?: string }> {
  // If Resend API key is not configured, log a warning but don't fail
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Support email will not be sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const supportEmail = 'support@householdtoolbox.com';
    
    // Map type to display name
    const typeLabels = {
      question: 'Question',
      support: 'Support Request',
      feature: 'Feature Recommendation',
      custom_tool: 'Custom Tool Request',
    };
    
    const typeLabel = typeLabels[type];
    const emailSubject = `[${typeLabel}] ${subject}`;
    
    console.log(`[Email] Sending support email from ${email} to ${supportEmail}`);
    
    const { data, error } = await resend.emails.send({
      from: `Household Toolbox <${fromEmail}>`,
      to: [supportEmail],
      replyTo: email,
      subject: emailSubject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Support Request</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; background-color: #f8fafc; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <!-- Header -->
              <div style="background-color: #0f172a; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 600;">
                  🧰 Household Toolbox
                </h1>
              </div>
              
              <!-- Main Content -->
              <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #475569; font-size: 14px; font-weight: 600;">
                    Type: <span style="color: #10b981;">${typeLabel}</span>
                  </p>
                </div>
                
                <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 600;">
                  ${subject}
                </h2>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
                  <p style="color: #475569; font-size: 16px; margin: 0; white-space: pre-wrap;">${message}</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                  <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
                    <strong>From:</strong> ${name} (${email})
                  </p>
                  <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
                    <strong>Date:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; margin-top: 20px; padding: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
                  This email was sent from the Household Toolbox support form.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
${typeLabel}: ${subject}

${message}

---
From: ${name} (${email})
Date: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}

This email was sent from the Household Toolbox support form.
      `.trim(),
    });

    if (error) {
      console.error('[Email] Error sending support email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Support email sent successfully! Email ID: ${data?.id || 'N/A'}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending support email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}


