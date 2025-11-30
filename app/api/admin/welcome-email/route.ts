import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get the welcome email template from settings table
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'welcome_email_template')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error('Error fetching welcome email template:', error);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    // If no template exists, return default template
    if (!data || !data.value) {
      return NextResponse.json({
        template: {
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
        },
      });
    }

    return NextResponse.json({ template: data.value });
  } catch (error) {
    console.error('Error in welcome email API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { template } = body;

    if (!template || !template.subject || !template.html || !template.text) {
      return NextResponse.json(
        { error: 'Template must include subject, html, and text fields' },
        { status: 400 }
      );
    }

    // Upsert the welcome email template
    const { error } = await supabaseServer
      .from('settings')
      .upsert(
        {
          key: 'welcome_email_template',
          value: template,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      );

    if (error) {
      console.error('Error saving welcome email template:', error);
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in welcome email API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

