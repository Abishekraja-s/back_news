/** Editable public legal / info pages (admin Page Menu). */

export const STATIC_LEGAL_PAGES = [
  { slug: 'contact', label: 'Contact', path: '/contact' },
  { slug: 'editorial-policy', label: 'Editorial Policy', path: '/editorial-policy' },
  { slug: 'correction-policy', label: 'Correction Policy', path: '/correction-policy' },
  { slug: 'disclaimer', label: 'Disclaimer', path: '/disclaimer' },
  { slug: 'gdpr-privacy-policy', label: 'GDPR Privacy Policy', path: '/gdpr-privacy-policy' },
  { slug: 'privacy-policy', label: 'Privacy Policy', path: '/privacy-policy' },
  { slug: 'terms', label: 'Terms of Use', path: '/terms' },
  { slug: 'copyright', label: 'Copyright', path: '/copyright' },
  { slug: 'grievance', label: 'Grievance', path: '/grievance' },
  { slug: 'advertise', label: 'Advertisement Us', path: '/advertise' },
  {
    slug: 'marketplace-disclaimer',
    label: 'Marketplace Disclaimer',
    path: '/marketplace-disclaimer',
    hasAgreementText: true,
  },
  {
    slug: 'matrimony-disclaimer',
    label: 'Matrimony Disclaimer',
    path: '/matrimony-disclaimer',
    hasAgreementText: true,
  },
];

export const STATIC_LEGAL_SLUGS = STATIC_LEGAL_PAGES.map((p) => p.slug);

export const isStaticLegalSlug = (slug) => STATIC_LEGAL_SLUGS.includes(slug);

const page = (pageTitle, intro, sections, extra = {}) => ({
  pageTitle,
  intro,
  sections,
  contactEmail: extra.contactEmail || 'contact@thegreatindianews.com',
  agreementCheckboxText: extra.agreementCheckboxText || '',
  enquiryAgreementText: extra.enquiryAgreementText || '',
});

export const STATIC_LEGAL_DEFAULTS = {
  contact: page('Contact Us', 'Reach The Great India News team using the details below.', [
    {
      heading: 'Contact details',
      body: `Email: contact@thegreatindianews.com

Phone: +91 9876543210

Address: Chennai, Tamil Nadu, India`,
    },
  ]),

  'editorial-policy': page(
    'Editorial Policy',
    'The Great India News is built upon double-layered validation and trusted, ground-zero journalism.',
    [
      {
        heading: '1. Double-Layered Story Verification',
        body: `Our reporting stack is certified by rigorous secondary audits:

• All claims must have double-layered citation mappings.
• No sensationalism or anonymous reporting is accepted unless vetted by the Editor-in-Chief.`,
      },
      {
        heading: '2. Retraction & Error Correction Timelines',
        body: 'We believe in full transparency. When mistakes are verified, we commit to publishing clear corrections within 24 business hours.',
      },
    ]
  ),

  'correction-policy': page(
    'Correction Policy',
    'We are committed to accuracy in our reporting.',
    [
      {
        heading: 'How to report an error',
        body: 'If you find an error in our reporting, please contact us at corrections@thegreatindianews.com. We will review and publish corrections promptly.',
      },
    ]
  ),

  disclaimer: page(
    'Disclaimer',
    'Welcome to “THE GREAT INDIA NEWS,” your trusted source for news and information in Tamil. Before using our website and accessing our content, please read this disclaimer carefully.',
    [
      {
        heading: 'Accuracy of Information',
        body: 'While we strive to provide accurate and up-to-date information, “THE GREAT INDIA News” cannot guarantee the completeness, reliability, or accuracy of the content published on our website. The views and opinions expressed in articles, opinion pieces, and other forms of content are those of the authors and do not necessarily reflect the views of “THE GREAT INDIA News” or its editorial team.',
      },
      {
        heading: 'Editorial Integrity',
        body: 'Our editorial team adheres to strict journalistic standards and ethics in the creation and publication of content. We maintain editorial independence and objectivity in reporting news and strive to present balanced and unbiased perspectives on various topics. However, readers should exercise their own judgment and discretion when interpreting and relying on the information provided.',
      },
      {
        heading: 'Third-Party Content',
        body: '“THE GREAT INDIA NEWS” may contain links to third-party websites, articles, or resources for informational purposes. We do not endorse or guarantee the accuracy of the content provided on these external sites and are not responsible for any loss or damage that may arise from their use. Users should review the terms of use and privacy policies of these third-party sites before accessing their content.',
      },
      {
        heading: 'No Legal or Professional Advice',
        body: 'The information provided on “THE GREAT INDIA NEWS” is for general informational purposes only and should not be construed as legal, financial, medical, or professional advice. Readers should seek appropriate professional advice or conduct their own research before making any decisions based on the information provided on our website.',
      },
      {
        heading: 'Changes to Content',
        body: '“THE GREAT INDIA NEWS” reserves the right to modify, update, or remove content from our website at any time without prior notice. We may also revise this disclaimer or other policies governing the use of our website. By continuing to use our website, you agree to be bound by the most current version of these terms and conditions.',
      },
      {
        heading: 'Limitation of Liability',
        body: 'Under no circumstances shall “THE GREAT INDIA NEWS” or its affiliates be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use our website or the content provided therein. This includes but is not limited to damages for loss of profits, data, or goodwill.',
      },
      {
        heading: 'Contact Us',
        body: 'If you have any questions or concerns about this disclaimer or our website’s content, please contact us at grievance@thegreatindianews.com.',
      },
    ],
    { contactEmail: 'grievance@thegreatindianews.com' }
  ),

  'gdpr-privacy-policy': page(
    'GDPR Privacy Policy',
    'At “THE GREAT INDIA NEWS”, we are committed to protecting the privacy and personal data of our users in compliance with the General Data Protection Regulation (GDPR). This policy outlines how we collect, use, disclose, and protect personal data when you use our website and services.',
    [
      {
        heading: 'Data Collection and Processing',
        body: `We collect and process personal data for specified, explicit, and legitimate purposes. When you visit our website or interact with our services, we may collect the following types of personal data:

• Contact Information: Such as your name, email address, postal address, and phone number, which you provide when subscribing to our magazine or signing up for our newsletter.
• Usage Information: Such as your IP address, browser type, device information, and browsing behavior on our website, collected through cookies and similar technologies.
• Payment Information: If you make purchases through our website, we may collect payment details such as credit card numbers or other financial information. However, we do not store this information on our servers and use third-party payment processors to handle transactions securely.`,
      },
      {
        heading: 'Lawful Basis for Processing',
        body: `We only process personal data when we have a lawful basis to do so, such as:

• Consent: When you voluntarily provide us with your personal data for specific purposes, such as subscribing to our magazine or newsletter, you consent to the processing of your information for those purposes.
• Contractual Necessity: When processing personal data is necessary for the performance of a contract, such as fulfilling your subscription or delivering purchased products.
• Legitimate Interests: When processing is necessary for our legitimate interests, such as improving our services, preventing fraud, and ensuring the security of our website and users.`,
      },
      {
        heading: 'Data Security',
        body: 'We implement appropriate technical and organizational measures to ensure the security of personal data and protect it from unauthorized access, disclosure, alteration, or destruction. These measures include encryption, access controls, and regular security assessments.',
      },
      {
        heading: 'Data Retention',
        body: 'We retain personal data only for as long as necessary to fulfill the purposes for which it was collected, or as required by law. When personal data is no longer needed, we securely delete or anonymize it to prevent identification.',
      },
      {
        heading: 'Your Rights',
        body: `Under the GDPR, you have certain rights regarding your personal data, including:

• Right to Access: You have the right to request access to the personal data we hold about you and receive information about how it is processed.
• Right to Rectification: You have the right to request the correction of inaccurate or incomplete personal data.
• Right to Erasure: You have the right to request the deletion of your personal data under certain circumstances, such as when it is no longer necessary for the purposes for which it was collected.
• Right to Object: You have the right to object to the processing of your personal data in certain situations, such as for direct marketing purposes.
• Right to Data Portability: You have the right to receive a copy of your personal data in a structured, commonly used, and machine-readable format, and to transmit it to another controller.`,
      },
      {
        heading: 'Contact Us',
        body: 'If you have any questions or concerns about our GDPR Policy or our practices regarding your personal information, please contact us at grievance@thegreatindianews.com.',
      },
    ],
    { contactEmail: 'grievance@thegreatindianews.com' }
  ),

  'privacy-policy': page(
    'Privacy Policy',
    'This document clarifies how The Great India News (thegreatindianews.com) and its related mobile applications collect, process, and safeguard your personal details. We are strictly committed to keeping all reader metrics safe and securely protected.',
    [
      {
        heading: '1. Data Collected on Website & Mobile App',
        body: `We collect information to customize and personalize your news tracking experience:

• Profile Information: When you register an account, comment, or interact with our members area we collect your name, email address, password, and preferences.
• Offline Storage & Read Milestones: We measure and record connection parameters and read engagements locally inside high-performance databases to serve you cached stories when offline.
• Device & Network Data: Connection attributes including IP address, browser type, device fingerprints, operating system, and system locales are gathered automatically.`,
      },
      {
        heading: '2. Usage, Sharing, and Protection of Your Data',
        body: `Your details are exclusively used to optimize client operations and support independent content. We enforce these criteria:

• Personalization: Tuning display sizes, localized spot rates, and curated newsletter digests.
• Security Measures: We apply secure industry SSL/TLS encryption. All critical databases are protected behind tokenized cloud firewall controls.
• Third-Party Sharing (Restricted): We integrate with trusted services only. We share non-personally identifiable browser cookies with Google AdSense and Google Analytics. We do NOT sell or syndicate details to third parties.`,
      },
      {
        heading: '3. Data and Mobile Account Deletion Request',
        body: 'In strict accordance with the Google Play Store App Developer Policies, users can request the deletion of their accounts and associated personal records at any time. To delete your data, use the Account & Security panel inside the app dashboard, or send a request email to grievance@thegreatindianews.com with the subject line “Data Deletion Request”. All personal registration details, comments history, and read logs will be permanently scrubbed from our active cloud and offline databases within 14 business days.',
      },
      {
        heading: '4. Cookie Control & Opt-out Mechanisms',
        body: 'This site utilizes browser cookies to save localized preference variables (such as custom font selections, layout density, and theme preferences). You can specify cookie handling within your browser settings, or deny specific tracking by managing settings inside our monetization hubs.',
      },
      {
        heading: '5. Legal Redressal Under IT Rules 2021 (India)',
        body: 'As an Indian digital publisher, we correspond directly with local IT standards. Any reader grievance can be registered with our appointed Grievance Officer at grievance@thegreatindianews.com. Resolution occurs within 15 days of formal acknowledgement.',
      },
    ],
    { contactEmail: 'grievance@thegreatindianews.com' }
  ),

  terms: page(
    'Terms of Use',
    'Please read these Terms of Service carefully before utilizing The Great India News services. By accessing our news updates, you fully agree to follow these legal requirements.',
    [
      {
        heading: '1. Acceptable Use of Our Services',
        body: `You correspond strictly with standard community rules when posting comments:

• No hate speech, defaming language, or spamming is permitted.
• All intellectual content on the portal remains the sole property of our Bureau.`,
      },
      {
        heading: '2. Subscription, Account Security & Registration',
        body: 'Users can register accounts to preserve bookmark folders and track engagement. Keep passwords secure.',
      },
      {
        heading: '3. Indemnification and Liability Disclaimers',
        body: 'Our news archives are served for informational purposes only. The Bureau is not liable for structural updates.',
      },
    ]
  ),

  copyright: page(
    'Copyright',
    '© 2026 The Great India News. All rights reserved.',
    [
      {
        heading: 'Protection of content',
        body: 'All content, including text, images, and videos, is protected by copyright law. Unauthorized reproduction is prohibited.',
      },
    ]
  ),

  grievance: page(
    'Grievance Redressal',
    'We take reader concerns seriously and aim to resolve them promptly.',
    [
      {
        heading: 'How to raise a grievance',
        body: 'If you have any grievances regarding our content or services, please write to grievance@thegreatindianews.com. We will address your concerns within 15 working days.',
      },
    ],
    { contactEmail: 'grievance@thegreatindianews.com' }
  ),

  advertise: page(
    'Advertisement Us',
    'Partner with The Great India News to reach Tamil audiences across web and mobile.',
    [
      {
        heading: 'Advertise with us',
        body: `For advertising enquiries, sponsorships, and media kits, contact our advertising desk.

Email: grievance@thegreatindianews.com

Please include your brand name, campaign goals, preferred dates, and budget range so we can respond quickly.`,
      },
    ],
    { contactEmail: 'grievance@thegreatindianews.com' }
  ),

  'marketplace-disclaimer': page(
    'Important Notice – Marketplace',
    'The Great India News (TGI News) provides this Marketplace platform to help buyers and sellers connect.',
    [
      {
        heading: 'Please note',
        body: `• TGI News is not the seller, buyer, manufacturer or payment intermediary for listed products.
• We do not guarantee the quality, condition, authenticity, ownership, availability or accuracy of any product listing.
• Buyers are responsible for verifying the product, seller identity, price and other details before making a purchase.
• Do not transfer money in advance to unknown sellers without proper verification.
• Never share OTPs, passwords, banking PINs or confidential financial information.
• Meet sellers in safe public locations whenever possible and inspect products before payment.
• TGI News is not responsible for disputes, fraud, financial losses, delivery issues or transactions between buyers and sellers, subject to applicable law.
• Report suspicious listings or users to our support team.`,
      },
      {
        heading: 'Enquiry consent',
        body: 'By submitting this enquiry, you agree that your submitted contact details and message may be shared with the relevant seller for the purpose of responding to your enquiry, in accordance with our Privacy Policy.',
      },
    ],
    {
      contactEmail: 'contact@thegreatindianews.com',
      agreementCheckboxText:
        'I have read and agree to the Important Notice – Marketplace and Privacy Policy. I understand that I must independently verify the seller and product before making any payment.',
      enquiryAgreementText:
        'By submitting this enquiry, you agree that your submitted contact details and message may be shared with the relevant seller for the purpose of responding to your enquiry, in accordance with our Privacy Policy.',
    }
  ),

  'matrimony-disclaimer': page(
    'Important Notice – Matrimony',
    'The Great India News (TGI News) provides a platform to help individuals and families connect for matrimonial purposes.',
    [
      {
        heading: 'Please note',
        body: `• TGI News is a matchmaking platform and does not guarantee marriage, compatibility or the accuracy of any matrimonial profile.
• We do not independently verify every profile, identity, education, employment, income, marital status, family background or other personal information unless explicitly stated.
• Users and their families are responsible for independently verifying all profile details before proceeding with a matrimonial relationship.
• Do not send money, gifts or financial assistance to someone you have only met online.
• Never share OTPs, passwords, bank details or sensitive identity documents with unknown individuals.
• Exercise caution when communicating, sharing photographs or arranging meetings.
• Report suspicious profiles, misleading information, harassment or requests for money to our support team.
• TGI News is not responsible for personal decisions, misrepresentation, disputes or losses arising from interactions between users, subject to applicable law.`,
      },
      {
        heading: 'Enquiry consent',
        body: 'By submitting this enquiry, you consent to your submitted name, contact number and message being shared with the relevant profile owner for the purpose of responding to your matrimonial enquiry, in accordance with our Privacy Policy.',
      },
    ],
    {
      contactEmail: 'contact@thegreatindianews.com',
      agreementCheckboxText:
        'I have read and agree to the Important Notice – Matrimony and Privacy Policy. I understand that I must independently verify any profile and information before meeting or making any payment.',
      enquiryAgreementText:
        'By submitting this enquiry, you consent to your submitted name, contact number and message being shared with the relevant profile owner for the purpose of responding to your matrimonial enquiry, in accordance with our Privacy Policy.',
    }
  ),
};

const asText = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

export const mergeStaticLegalContent = (slug, raw = {}) => {
  const defaults = STATIC_LEGAL_DEFAULTS[slug] || page('Page', '', [{ heading: 'Content', body: '' }]);
  const sectionsIn = Array.isArray(raw.sections) && raw.sections.length ? raw.sections : defaults.sections;

  return {
    pageTitle: asText(raw.pageTitle, defaults.pageTitle).trim() || defaults.pageTitle,
    intro: asText(raw.intro, defaults.intro),
    contactEmail: asText(raw.contactEmail, defaults.contactEmail).trim() || defaults.contactEmail,
    agreementCheckboxText: asText(raw.agreementCheckboxText, defaults.agreementCheckboxText || ''),
    enquiryAgreementText: asText(raw.enquiryAgreementText, defaults.enquiryAgreementText || ''),
    sections: sectionsIn.map((s, i) => ({
      heading: asText(s?.heading, defaults.sections[i]?.heading || `Section ${i + 1}`),
      body: asText(s?.body, defaults.sections[i]?.body || ''),
    })),
  };
};

export const validateStaticLegalContent = (content) => {
  const errors = [];
  if (!content?.pageTitle?.trim()) errors.push('Page title is required');
  if (!Array.isArray(content?.sections) || !content.sections.length) {
    errors.push('At least one section is required');
  } else {
    content.sections.forEach((s, i) => {
      if (!s.heading?.trim()) errors.push(`Section ${i + 1}: heading is required`);
      if (!s.body?.trim()) errors.push(`Section ${i + 1}: body is required`);
    });
  }
  return errors;
};

export const getStaticLegalMeta = (slug) => STATIC_LEGAL_PAGES.find((p) => p.slug === slug) || null;
