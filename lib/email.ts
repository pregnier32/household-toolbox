import { Resend } from 'resend';
import { supabaseServer } from '@/lib/supabaseServer';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

type WelcomeEmailParams = {
  to: string;
  firstName: string;
};

/**
 * Gets the welcome email template from the database or returns default
 */
async function getWelcomeEmailTemplate(): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  try {
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'welcome_email_template')
      .single();

    if (error || !data || !data.value) {
      // Return default template if not found
      return {
        subject: 'Welcome to Household Toolbox! 🧰',
        html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Household Toolbox</title>
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
        <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 600;">
          Welcome, \${firstName}! 👋
        </h2>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          Thank you for signing up for Household Toolbox! We're excited to help you organize, plan, and maintain your household.
        </p>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          With Household Toolbox, you can:
        </p>
        
        <ul style="color: #475569; font-size: 16px; margin: 20px 0; padding-left: 20px;">
          <li style="margin: 10px 0;">📅 Track maintenance schedules and get reminders</li>
          <li style="margin: 10px 0;">📂 Organize important documents and warranties</li>
          <li style="margin: 10px 0;">✅ Create and share checklists with your household</li>
          <li style="margin: 10px 0;">👥 Coordinate tasks with family members or roommates</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="\${appUrl}/dashboard" 
             style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Get Started
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          If you have any questions or need help getting started, feel free to reach out to us.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          © \${year} Household Toolbox. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          Built to make home life admin less painful.
        </p>
      </div>
    </div>
  </body>
</html>`,
        text: `Welcome to Household Toolbox, \${firstName}!

Thank you for signing up! We're excited to help you organize, plan, and maintain your household.

With Household Toolbox, you can:
- Track maintenance schedules and get reminders
- Organize important documents and warranties
- Create and share checklists with your household
- Coordinate tasks with family members or roommates

Get started: \${appUrl}/dashboard

If you have any questions or need help getting started, feel free to reach out to us.

© \${year} Household Toolbox. All rights reserved.
Built to make home life admin less painful.`,
      };
    }

    return data.value;
  } catch (error) {
    console.error('Error fetching welcome email template:', error);
    // Return default template on error
    return {
      subject: 'Welcome to Household Toolbox! 🧰',
      html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Household Toolbox</title>
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
        <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 600;">
          Welcome, \${firstName}! 👋
        </h2>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          Thank you for signing up for Household Toolbox! We're excited to help you organize, plan, and maintain your household.
        </p>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          With Household Toolbox, you can:
        </p>
        
        <ul style="color: #475569; font-size: 16px; margin: 20px 0; padding-left: 20px;">
          <li style="margin: 10px 0;">📅 Track maintenance schedules and get reminders</li>
          <li style="margin: 10px 0;">📂 Organize important documents and warranties</li>
          <li style="margin: 10px 0;">✅ Create and share checklists with your household</li>
          <li style="margin: 10px 0;">👥 Coordinate tasks with family members or roommates</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="\${appUrl}/dashboard" 
             style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Get Started
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          If you have any questions or need help getting started, feel free to reach out to us.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          © \${year} Household Toolbox. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          Built to make home life admin less painful.
        </p>
      </div>
    </div>
  </body>
</html>`,
      text: `Welcome to Household Toolbox, \${firstName}!

Thank you for signing up! We're excited to help you organize, plan, and maintain your household.

With Household Toolbox, you can:
- Track maintenance schedules and get reminders
- Organize important documents and warranties
- Create and share checklists with your household
- Coordinate tasks with family members or roommates

Get started: \${appUrl}/dashboard

If you have any questions or need help getting started, feel free to reach out to us.

© \${year} Household Toolbox. All rights reserved.
Built to make home life admin less painful.`,
    };
  }
}

/**
 * Replaces template variables in the email content
 */
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
    const html = replaceTemplateVariables(template.html, firstName, appUrl, year);
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

type PasswordResetEmailParams = {
  to: string;
  firstName: string;
  resetToken: string;
};

/**
 * Sends a password reset email to a user
 */
export async function sendPasswordResetEmail({ to, firstName, resetToken }: PasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  // If Resend API key is not configured, log a warning but don't fail
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Password reset email will not be sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    const year = new Date().getFullYear();
    
    const subject = 'Reset Your Household Toolbox Password';
    
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
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
        <h2 style="color: #1e293b; margin-top: 0; font-size: 22px; font-weight: 600;">
          Reset Your Password
        </h2>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          Hi ${firstName},
        </p>
        
        <p style="color: #475569; font-size: 16px; margin: 20px 0;">
          We received a request to reset your password for your Household Toolbox account. Click the button below to reset your password:
        </p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" 
             style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin: 20px 0;">
          Or copy and paste this link into your browser:
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 10px 0; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
          ${resetUrl}
        </p>
        
        <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          © ${year} Household Toolbox. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
          Built to make home life admin less painful.
        </p>
      </div>
    </div>
  </body>
</html>`;
    
    const text = `Reset Your Household Toolbox Password

Hi ${firstName},

We received a request to reset your password for your Household Toolbox account. Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

© ${year} Household Toolbox. All rights reserved.
Built to make home life admin less painful.`;
    
    console.log(`[Email] Sending password reset email to ${to} from ${fromEmail}`);
    
    const { data, error } = await resend.emails.send({
      from: `Household Toolbox <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text.trim(),
    });

    if (error) {
      console.error('[Email] Error sending password reset email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Password reset email sent successfully! Email ID: ${data?.id || 'N/A'}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

