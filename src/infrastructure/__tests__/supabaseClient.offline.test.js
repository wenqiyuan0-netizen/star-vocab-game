// Offline builds must never crash on cloud calls, whatever the query shape.
describe('supabase client in offline build', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, REACT_APP_OFFLINE: 'true' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  it('resolves arbitrary query chains to an offline error instead of throwing', async () => {
    const { supabase } = require('../supabaseClient');
    const res = await supabase.from('user_words').select('*').eq('user_id', 'x').order('de').limit(5).single();
    expect(res.data).toBeNull();
    expect(res.error.code).toBe('OFFLINE');
    const rpc = await supabase.rpc('add_xp', { xp_amount: 1 });
    expect(rpc.error.code).toBe('OFFLINE');
  });

  it('reports no session', async () => {
    const { supabase } = require('../supabaseClient');
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });

  it('marks cloud as disabled', () => {
    const { CLOUD_CONFIGURED, IS_OFFLINE_BUILD } = require('../../shared/constants/config');
    expect(IS_OFFLINE_BUILD).toBe(true);
    expect(CLOUD_CONFIGURED).toBe(false);
  });
});
