import React, { useState, useEffect } from 'react';
import BrandLogo from '../../../shared/components/ui/BrandLogo';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError('');
  }, [mode]);

  const handleLogin = async () => {
    setLoading(true);
    // Auto-trim inputs to prevent mobile keyboard issues
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const { error } = await signIn(cleanEmail, cleanPassword);
    if (error) {
      console.error("Login error:", error);
      if (error.message.includes('Invalid login credentials')) {
        setError('邮箱或密码错误（请注意大小写）');
      } else if (error.message.includes('Email not confirmed')) {
        setError('请先去邮箱确认验证邮件');
      } else {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setLoading(true);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const { error } = await signUp(cleanEmail, cleanPassword);
    if (error) {
      setError(error.message);
    } else {
      // Check if confirmation is required
      setError('注册成功！请检查邮箱进行验证（如果开启了验证）或直接登录');
      setMode('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-4">
          <BrandLogo size={64} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-6">星际词汇 (Cloud)</h1>

        <div className="flex mb-6 bg-gray-100 rounded-xl overflow-hidden">
          <button
            className={`flex-1 py-2 ${mode === 'login' ? 'bg-white font-semibold' : ''}`}
            onClick={() => setMode('login')}
          >登录</button>
          <button
            className={`flex-1 py-2 ${mode === 'register' ? 'bg-white font-semibold' : ''}`}
            onClick={() => setMode('register')}
          >注册</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">邮箱</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="请输入邮箱"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="请输入密码"
            />
          </div>

          {error && <div className={`text-sm ${error.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>{error}</div>}

          {mode === 'login' ? (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-2 mt-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full py-2 mt-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-6 text-center">数据将同步到云端</p>
      </div>
    </div>
  );
}
