import sanitizeHtml from 'sanitize-html';

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  'img',
  'h1',
  'h2',
  'h3',
  'figure',
  'figcaption',
  'iframe',
  'video',
  'source',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  img: ['src', 'alt', 'width', 'height', 'loading', 'class'],
  iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
  a: ['href', 'name', 'target', 'rel'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

export const sanitizeContent = (html) => {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
};

export default sanitizeContent;
