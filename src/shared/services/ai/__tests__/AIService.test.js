import { aiService, getAiConfig, setAiConfig, DEFAULT_GEMINI_MODEL } from '../AIService';

// The dictionary layer needs IndexedDB, which jsdom lacks; it is irrelevant here.
jest.mock('../../../../utils/unifiedDictionarySearch', () => ({ unifiedSearch: jest.fn() }));

describe('AIService (bring your own key)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  it('refuses to call the network without a user key', async () => {
    await expect(aiService.generateExample('Haus', '房子')).rejects.toMatchObject({ code: 'NO_API_KEY' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stores key + model only in localStorage and can clear them', () => {
    setAiConfig({ apiKey: '  test-key  ', model: '' });
    expect(getAiConfig()).toEqual({ apiKey: 'test-key', model: DEFAULT_GEMINI_MODEL });
    setAiConfig({ apiKey: '', model: '' });
    expect(getAiConfig().apiKey).toBe('');
  });

  it('sends the key in a header (never in the URL) directly to Google', async () => {
    setAiConfig({ apiKey: 'test-key' });
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n{"de":"Das Haus ist groß.","cn":"房子很大。"}\n```' }] } }] }),
    });

    const out = await aiService.generateExample('Haus', '房子');

    expect(out).toEqual({ de: 'Das Haus ist groß.', cn: '房子很大。' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
    expect(url).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
  });

  it('surfaces an invalid key as a readable error', async () => {
    setAiConfig({ apiKey: 'bad' });
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    await expect(aiService.generateExample('Haus', '房子')).rejects.toThrow(/API key/i);
  });
});
