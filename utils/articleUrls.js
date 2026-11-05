/**
 * Public article path: /{category-slug}/{news-slug}
 * Requires article.category populated with { slug }, or categorySlug string.
 */
export const getArticlePublicPath = (article) => {
  const newsSlug = article?.slug ? String(article.slug).trim() : '';
  if (!newsSlug) return '/';
  const categorySlug =
    (typeof article?.category === 'object' && article.category?.slug
      ? String(article.category.slug).trim()
      : '') ||
    (typeof article?.categorySlug === 'string' ? article.categorySlug.trim() : '');
  if (categorySlug) return `/${categorySlug}/${newsSlug}`;
  return `/news/${newsSlug}`;
};

export const getArticlePublicUrl = (article, baseUrl = '') => {
  const origin = String(baseUrl || '').replace(/\/$/, '');
  const path = getArticlePublicPath(article);
  return origin ? `${origin}${path}` : path;
};
