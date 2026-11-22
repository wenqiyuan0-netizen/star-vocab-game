import { locales } from '../locales';
import { translate } from '../index';

const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');

describe('locales', () => {
  const zhKeys = Object.keys(locales.zh).sort();

  it.each(['en', 'de'])('%s has exactly the same keys as zh', (lang) => {
    expect(Object.keys(locales[lang]).sort()).toEqual(zhKeys);
  });

  it.each(['en', 'de'])('%s keeps every {placeholder} of zh', (lang) => {
    const mismatched = zhKeys.filter((k) => placeholders(locales.zh[k]) !== placeholders(locales[lang][k]));
    expect(mismatched).toEqual([]);
  });

  it('interpolates variables and falls back to the key', () => {
    expect(translate('home.learned', { n: 3, total: 10 }, 'en')).toBe('Learned 3 / 10');
    expect(translate('missing.key', null, 'de')).toBe('missing.key');
  });
});
