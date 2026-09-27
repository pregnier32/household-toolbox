/**
 * Published Terms of Service and Privacy Policy.
 * Served by the public pages and /api/legal.
 */

export const LEGAL_LAST_UPDATED = '2026-09-26';

const h2 = (text: string) =>
  `<h2 class="text-2xl font-semibold text-slate-100 mt-8 mb-4">${text}</h2>`;
const h3 = (text: string) =>
  `<h3 class="text-xl font-semibold text-slate-100 mt-6 mb-3">${text}</h3>`;
const p = (html: string) => `<p>${html}</p>`;
const ul = (items: string[]) =>
  `<ul class="list-disc pl-6 space-y-2">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;

const supportEmail = '<strong class="text-emerald-400">support@householdtoolbox.com</strong>';

export function formatLegalDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return 'September 26, 2026';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export const TERMS_OF_SERVICE_HTML = [
  p(
    'Welcome to <strong>Household Toolbox</strong> (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of our website, tools, and services (collectively, the &ldquo;Service&rdquo;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.'
  ),

  h2('1. Eligibility'),
  p(
    'You must be at least 13 years old to use the Service. By using the Service, you represent that you meet this requirement.'
  ),

  h2('2. Your Account'),
  p('To use the tools, you create an account with your name, email address, and a password.'),
  p('You agree to:'),
  ul([
    'Provide accurate and current information',
    'Maintain the security of your login credentials',
    'Notify us immediately of any unauthorized access',
    'Accept responsibility for all activities under your account',
  ]),
  p(
    'We may suspend or terminate accounts that violate these Terms. You can delete your account from your profile after you remove your tools. Section 14 explains what happens to your information.'
  ),

  h2('3. Use of the Service'),
  p('You agree not to:'),
  ul([
    'Use the Service for any unlawful purpose',
    'Attempt to access or modify systems without authorization',
    'Copy, distribute, or reverse engineer the Service',
    'Upload malicious code, spam, or harmful content',
    'Interfere with or disrupt the Service&rsquo;s functionality',
  ]),
  p('We reserve the right to restrict or terminate access if misuse occurs.'),

  h2('4. Plans and Payments'),
  p(
    'The Service currently lets you add tools and store files within the limits shown in the product. We do not currently charge a payment method.'
  ),
  p('If we later offer paid tools, extra storage, or other paid features:'),
  ul([
    'The price, billing period, and what is included will be shown before you confirm.',
    'We will charge a payment method only after a payment processor is connected and you authorize that charge.',
    'We may change prices. The new price will be shown before it applies to you.',
    'You may stop a paid feature or close your account from the product. Access to a paid feature ends when that feature is canceled, subject to any period already shown at checkout.',
    'Fees already charged are refundable only where the law requires a refund, unless the checkout terms say otherwise.',
  ]),

  h2('5. Not Professional Advice'),
  p(
    'The Service is a household organization tool. It does not provide medical, legal, tax, insurance, or financial advice, and using it does not create a professional relationship with Household Toolbox.'
  ),
  p(
    'Information you enter, including healthcare appointments, HSA records, insurance details, money records, and end-of-life plans, is stored for your own household use. It does not replace advice from a qualified professional, and it does not replace wills, healthcare directives, or other documents the law requires.'
  ),

  h2('6. Intellectual Property'),
  p(
    'All content, branding, software, design, and functionality on the Service are owned by Household Toolbox or our licensors and protected by intellectual property laws.'
  ),
  p('You may use the Service only as permitted. You do not obtain ownership of any part of the Service by using it.'),

  h2('7. User Content'),
  p(
    'You may enter information and upload files into the Service (&ldquo;User Content&rdquo;). User Content can include schedules, lists, notes, contacts, home and repair records, pet records, healthcare information, HSA and other money records, important documents, and end-of-life plans.'
  ),
  p(
    'You retain ownership of your User Content. You grant us a limited, non-exclusive license to store, display, and process User Content solely to provide the Service to your account, including exports and files you ask the Service to generate.'
  ),
  p('You represent that:'),
  ul([
    'You have the rights to submit the User Content',
    'Your User Content does not violate any laws or rights of others',
  ]),
  p('We may remove User Content that violates these Terms.'),

  h2('8. Privacy'),
  p(
    `Your use of the Service is also governed by our <a href="/privacy-policy" class="text-emerald-400 hover:text-emerald-300 underline">Privacy Policy</a>, which explains how we collect, use, and store your information.`
  ),

  h2('9. Service Providers'),
  p(
    'We use service providers to host the Service, store account data and files, and send account email. Their role is described in the Privacy Policy. We are not responsible for third-party websites you choose to open from outside the Service.'
  ),

  h2('10. Service Availability'),
  p('We work to keep the Service running and to store your User Content while your account is active. We do not guarantee:'),
  ul([
    'Uninterrupted availability',
    'Error-free performance',
    'That your data will always be available or recoverable',
  ]),
  p(
    'Keep your own copies of important documents and records. We may modify or discontinue parts of the Service at any time.'
  ),

  h2('11. Disclaimer of Warranties'),
  p(
    'The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. We disclaim all warranties, including merchantability, fitness for a particular purpose, and non-infringement.'
  ),
  p('Some jurisdictions do not allow certain disclaimers; in those cases, some may not apply.'),

  h2('12. Limitation of Liability'),
  p(
    'To the fullest extent permitted by law, Household Toolbox and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.'
  ),
  p(
    'Our total liability for any claim will not exceed the amount you paid us in the past 12 months, or $50 if you have not made any payments.'
  ),

  h2('13. Indemnification'),
  p(
    'You agree to indemnify and hold harmless Household Toolbox, its affiliates, and employees from any claims, damages, or expenses arising from:'
  ),
  ul([
    'Your use of the Service',
    'Your User Content',
    'Your violation of these Terms',
    'Your violation of any law or third-party rights',
  ]),

  h2('14. Termination and Deletion'),
  p(
    'We may suspend or terminate your access at any time for any reason, including violation of these Terms. You may delete your account from your profile after you remove your tools in My Tools.'
  ),
  p('When you delete your account, we delete the account, the tool records tied to it, and the uploaded files tied to it.'),
  p('When we close your account, your right to use the Service ends, and we may delete the account, tool records, and uploaded files.'),
  p(
    'We may keep limited information after an account ends when we need it for security, legal, or dispute reasons, including email we exchanged with you about support. Sections of these Terms that should reasonably survive termination will continue, including ownership of intellectual property, disclaimers, limits on liability, and indemnification.'
  ),

  h2('15. Changes to These Terms'),
  p('We may update these Terms occasionally. When we do, we will update the &ldquo;Last Updated&rdquo; date above.'),
  p(
    'If changes are significant, we may provide additional notice. Continued use of the Service means you accept the updated Terms.'
  ),

  h2('16. Governing Law'),
  p(
    'These Terms are governed by the laws of the United States, without regard to conflict of law principles.'
  ),

  h2('17. Contact Us'),
  p('If you have questions about these Terms, contact us at:'),
  p(supportEmail),
].join('\n');

export const PRIVACY_POLICY_HTML = [
  p(
    'Household Toolbox (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, tools, and services (collectively, the &ldquo;Service&rdquo;).'
  ),
  p('By using the Service, you agree to the practices described in this Privacy Policy.'),

  h2('1. Information We Collect'),

  h3('1.1 Information You Provide'),
  ul([
    '<strong>Account information:</strong> First name, last name, email address, and password. We store the password as a hash, so we do not keep a readable copy of it. We also store your theme preference so the Service can remember light or dark mode.',
    '<strong>Password reset:</strong> If you ask to reset your password, we email you a link and store a reset token until you use it or it expires (about one hour).',
    '<strong>User Content:</strong> Information you enter into the tools. That can include schedules, tasks, lists, notes, goals, meals, and calendar events; home maintenance, cleaning, and repair records; healthcare appointments and history; HSA accounts, deposits, and expenses; subscription, event-budget, and other money records you enter; pet care and veterinary records; address-book contacts; travel logs; and end-of-life plans, including personal, financial, and wish information you choose to enter.',
    '<strong>Files:</strong> Documents, photos, and other files you upload to a tool, including files attached to important documents, healthcare records, HSA expenses, and end-of-life plans.',
    '<strong>Support requests:</strong> The name, email address, subject, and message you send through the support form or by email.',
  ]),

  h3('1.2 Technical Information'),
  p('When you use the Service, we and our hosting provider may process:'),
  ul([
    '<strong>Session information:</strong> A sign-in cookie that keeps you logged in. See Section 7.',
    '<strong>Server logs:</strong> IP address, browser type, device type, and pages requested, which our hosting provider may record to deliver and protect the site.',
  ]),
  p('We do not use a third-party analytics product, and we do not use this information for advertising.'),

  h2('2. How We Use Your Information'),
  p('We use your information to:'),
  ul([
    'Provide, maintain, and protect the Service',
    'Operate the tools and files you choose to use, including exports you request',
    'Remember your theme preference',
    'Send account email, including a welcome message and password-reset links',
    'Respond to support requests',
    'Comply with legal obligations',
  ]),
  p(
    'We send those account and support messages so the Service can operate. We do not send marketing newsletters. We do <strong>not</strong> sell your personal information, and we do <strong>not</strong> use it for advertising.'
  ),

  h2('3. How We Share Your Information'),

  h3('3.1 Service Providers'),
  p('We share information with providers that process it on our behalf to run the Service:'),
  ul([
    '<strong>Vercel</strong> hosts the application and may process technical log data.',
    '<strong>Supabase</strong> stores account data, tool records, and uploaded files.',
    '<strong>Resend</strong> delivers account email and support messages.',
  ]),
  p('They may use your information only to perform those services.'),

  h3('3.2 Legal Requirements'),
  p(
    'We may disclose information if required to comply with laws, court orders, or government requests, or to protect our rights, users, or the public.'
  ),

  h3('3.3 Business Transfers'),
  p(
    'If Household Toolbox is involved in a merger, acquisition, or asset sale, your information may be transferred as part of the transaction.'
  ),
  p('We <strong>do not</strong> share your personal information with advertisers.'),

  h2('4. Data Retention'),
  p('We keep your account, tool records, and uploaded files while your account is active.'),
  p(
    'You can delete your account from your profile after you remove your tools in My Tools. Deleting the account deletes the account, the tool records tied to it, and the uploaded files tied to it. You can also email us and ask us to delete your account.'
  ),
  p(
    'Support messages are delivered by email and may remain in our email records after the account is deleted. We may also keep limited information when we need it to comply with the law, resolve a dispute, or enforce these terms.'
  ),

  h2('5. How We Protect Your Information'),
  p('We use administrative and technical safeguards, including:'),
  ul([
    'Encrypted connections (HTTPS)',
    'Passwords stored as hashes',
    'An httpOnly sign-in cookie',
    'Account-scoped storage for tool records and uploaded files',
  ]),
  p('No online service can guarantee perfect security.'),

  h2('6. Your Rights &amp; Choices'),
  p('Depending on your location, you may have rights such as:'),
  ul([
    '<strong>Access:</strong> Ask for a copy of the personal information we hold about you',
    '<strong>Correction:</strong> Update your name and other account details from your profile, or ask us to correct them',
    '<strong>Deletion:</strong> Delete your account from your profile, or ask us to delete it',
    '<strong>Restriction:</strong> Ask us to limit how your information is used',
    '<strong>Portability:</strong> Ask us to send you a copy of your account information and tool data',
  ]),
  p(
    'There is no self-serve export of your whole account. To ask for a copy, a correction, a restriction, or help deleting an account, email ' +
      supportEmail +
      '.'
  ),

  h2('7. Cookies'),
  p(
    'We use one first-party cookie, <strong>household-toolbox-session</strong>, to keep you signed in. It is httpOnly, lasts about 7 days, and is sent only to our site. We do not use analytics cookies or advertising cookies.'
  ),
  p('If you block that cookie, you will need to sign in again, and parts of the Service will not stay signed in.'),

  h2('8. Children&rsquo;s Privacy'),
  p(
    'The Service is not intended for anyone under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided information, contact us and we will delete it.'
  ),

  h2('9. International Users'),
  p(
    'If you access the Service from outside the United States, your information may be transferred to and stored in the United States, where our service providers operate. By using the Service, you consent to that transfer.'
  ),

  h2('10. Changes to This Privacy Policy'),
  p(
    'We may update this Privacy Policy periodically. When we do, we will update the &ldquo;Last Updated&rdquo; date above. If changes are significant, we may provide additional notice.'
  ),
  p('Continued use of the Service means you accept the updated policy.'),

  h2('11. Contact Us'),
  p('If you have questions about this Privacy Policy, contact us:'),
  p(supportEmail),
].join('\n');
