/** Default About Us page content — seeded on first access and used as API fallback */
export const ABOUT_PAGE_DEFAULTS = {
  hero: {
    label: 'ABOUT OUR MISSION',
    heading: 'Independent, Public-Interest Journalism for India',
    description:
      'Serving the public with independent journalism that puts truth, transparency, accountability, and public interest first.',
  },
  cards: [
    {
      title: 'Our Mission & Editorial Philosophy',
      content:
        'We believe in journalism that serves the public interest, strengthens democracy, challenges misinformation, and gives citizens the information they need to make informed decisions. Our editorial approach is independent, transparent, responsible, and focused on meaningful public-interest reporting.',
      footerLabel: 'Independent & Public Interest',
    },
    {
      title: 'Publisher Registry & Trust',
      content:
        'The Great India News is committed to transparency and responsible publishing. We maintain accurate publisher information and follow responsible editorial practices to build credibility and public trust.',
      footerLabel: 'Trust & Transparency',
    },
  ],
  founder: {
    sectionTitle: 'Independent Journalism, Powered by People',
    subtitle: 'Our leadership and editorial team are committed to responsible journalism.',
    name: 'R. Abishekraja',
    designation: 'FOUNDER AND CHAIRMAN',
    description:
      'R. Abishekraja is the founder and chairman of The Great India News, with a passion for social welfare and a commitment to serving the public interest. His vision is to build an independent publishing platform that delivers credible, responsible, and meaningful news to readers across India. The organization is guided by principles of transparency, accuracy, accountability, and public-interest journalism.',
    initials: 'RA',
  },
  bureauOverview: {
    title: 'BUREAU OVERVIEW',
    stats: [
      { label: 'FOUNDING YEAR', value: '2021', icon: 'calendar' },
      { label: 'HEADQUARTERS', value: 'CHENNAI', icon: 'pin' },
      { label: 'DAILY REACH', value: '45K+', icon: 'reach' },
      { label: 'REPORTING NETWORK', value: '25+', icon: 'network' },
    ],
  },
  meta: {
    pageTitle: 'About Us',
    metaDescription:
      'The Great India News — independent, public-interest journalism for India. Founded in 2021, based in Chennai.',
  },
};

export const mergeAboutContent = (stored) => {
  const base = structuredClone(ABOUT_PAGE_DEFAULTS);
  if (!stored || typeof stored !== 'object') return base;

  return {
    hero: { ...base.hero, ...(stored.hero || {}) },
    cards: Array.isArray(stored.cards) && stored.cards.length
      ? stored.cards.map((card, i) => ({ ...base.cards[i], ...card }))
      : base.cards,
    founder: { ...base.founder, ...(stored.founder || {}) },
    bureauOverview: {
      ...base.bureauOverview,
      ...(stored.bureauOverview || {}),
      stats:
        Array.isArray(stored.bureauOverview?.stats) && stored.bureauOverview.stats.length
          ? stored.bureauOverview.stats
          : base.bureauOverview.stats,
    },
    meta: { ...base.meta, ...(stored.meta || {}) },
  };
};

export const validateAboutContent = (content) => {
  const errors = [];

  if (!content?.hero?.label?.trim()) errors.push('Hero label is required');
  if (!content?.hero?.heading?.trim()) errors.push('Hero heading is required');
  if (!content?.hero?.description?.trim()) errors.push('Hero description is required');

  if (!Array.isArray(content?.cards) || content.cards.length < 2) {
    errors.push('Two information cards are required');
  } else {
    content.cards.slice(0, 2).forEach((card, i) => {
      if (!card?.title?.trim()) errors.push(`Card ${i + 1} title is required`);
      if (!card?.content?.trim()) errors.push(`Card ${i + 1} content is required`);
    });
  }

  if (!content?.founder?.sectionTitle?.trim()) errors.push('Founder section title is required');
  if (!content?.founder?.name?.trim()) errors.push('Founder name is required');
  if (!content?.founder?.designation?.trim()) errors.push('Founder designation is required');
  if (!content?.founder?.description?.trim()) errors.push('Founder description is required');

  if (!content?.bureauOverview?.title?.trim()) errors.push('Bureau overview title is required');
  if (!Array.isArray(content?.bureauOverview?.stats) || !content.bureauOverview.stats.length) {
    errors.push('At least one bureau statistic is required');
  } else {
    content.bureauOverview.stats.forEach((stat, i) => {
      if (!stat?.label?.trim()) errors.push(`Stat ${i + 1} label is required`);
      if (!stat?.value?.trim()) errors.push(`Stat ${i + 1} value is required`);
    });
  }

  return errors;
};
