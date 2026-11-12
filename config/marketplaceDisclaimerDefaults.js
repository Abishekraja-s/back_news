export const MARKETPLACE_DISCLAIMER_SLUG = 'marketplace-disclaimer';

export const MARKETPLACE_DISCLAIMER_DEFAULTS = {
  pageTitle: 'Marketplace Disclaimer',
  intro:
    'Welcome to The Great India News Marketplace. Before registering as a seller, listing products, or making any purchase, please read this disclaimer carefully.',
  agreementCheckboxText:
    'I have read and agree to the Marketplace Disclaimer and Privacy Policy. I understand that I must independently verify the seller and product before making any payment.',
  sections: [
    {
      heading: 'Independent verification',
      body: `I have read and agree to the Marketplace Disclaimer and Privacy Policy. I understand that I must independently verify the seller and product before making any payment.

The Great India News provides a platform for sellers to list products and for buyers to discover them. We do not sell the listed products ourselves and are not a party to transactions between buyers and sellers unless expressly stated.`,
    },
    {
      heading: 'No guarantee of sellers or products',
      body: 'We do not guarantee the identity, reputation, or conduct of any seller, or the quality, safety, legality, authenticity, or availability of any product. Buyers must independently verify the seller and the product (including price, condition, delivery, and payment terms) before making any payment.',
    },
    {
      heading: 'Payments and disputes',
      body: 'Any payment, delivery, refund, or dispute is solely between the buyer and the seller. The Great India News is not responsible for failed payments, non-delivery, defective goods, or misrepresentation by either party.',
    },
    {
      heading: 'Seller responsibility',
      body: 'Sellers must provide accurate business and product information, comply with applicable laws, and honour commitments made to buyers. False or misleading listings may be removed and accounts may be suspended.',
    },
    {
      heading: 'Privacy',
      body: 'Personal data collected for marketplace registration and enquiries is handled as described in our Privacy Policy.',
    },
    {
      heading: 'Contact',
      body: 'For marketplace-related questions, contact contact@thegreatindianews.com.',
    },
  ],
  contactEmail: 'contact@thegreatindianews.com',
};

const asText = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

export const mergeMarketplaceDisclaimerContent = (raw = {}) => {
  const defaults = MARKETPLACE_DISCLAIMER_DEFAULTS;
  const sectionsIn = Array.isArray(raw.sections) ? raw.sections : defaults.sections;

  return {
    pageTitle: asText(raw.pageTitle, defaults.pageTitle).trim() || defaults.pageTitle,
    intro: asText(raw.intro, defaults.intro),
    agreementCheckboxText: asText(raw.agreementCheckboxText, defaults.agreementCheckboxText),
    contactEmail: asText(raw.contactEmail, defaults.contactEmail).trim() || defaults.contactEmail,
    sections: sectionsIn.map((s, i) => ({
      heading: asText(s?.heading, defaults.sections[i]?.heading || `Section ${i + 1}`),
      body: asText(s?.body, defaults.sections[i]?.body || ''),
    })),
  };
};

export const validateMarketplaceDisclaimerContent = (content) => {
  const errors = [];
  if (!content?.pageTitle?.trim()) errors.push('Page title is required');
  if (!content?.intro?.trim()) errors.push('Intro is required');
  if (!content?.agreementCheckboxText?.trim()) errors.push('Agreement checkbox text is required');
  if (!Array.isArray(content?.sections) || content.sections.length === 0) {
    errors.push('At least one section is required');
  } else {
    content.sections.forEach((s, i) => {
      if (!s.heading?.trim()) errors.push(`Section ${i + 1}: heading is required`);
      if (!s.body?.trim()) errors.push(`Section ${i + 1}: body is required`);
    });
  }
  return errors;
};
