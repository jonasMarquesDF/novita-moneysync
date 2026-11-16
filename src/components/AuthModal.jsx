import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  Cloud,
  CloudOff,
  KeyRound,
  Sparkles
} from 'lucide-react';
import {
  isConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithMagicLink,
  logOut
} from '../supabase.js';

export function AuthModal({ user, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'magic'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await signInWithEmailPassword(email, password);
        onAuthSuccess?.(data.user);
        onClose();
      } else if (mode === 'signup') {
        const data = await signUpWithEmailPassword(email, password, name);
        if (data.session) {
          onAuthSuccess?.(data.user);
          onClose();
        } else {
          setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
        }
      } else if (mode === 'magic') {
        await signInWithMagicLink(email);
        setSuccessMsg('Link de acesso enviado para o seu e-mail!');
      }
    } catch (err) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await logOut();
      onAuthSuccess?.(null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isConfigured ? <Cloud size={22} color="#183f35" /> : <CloudOff size={22} color="#b45309" />}
            <h2 id="auth-modal-title" style={{ margin: 0 }}>
              {user ? 'Sua Conta' : 'Conectar à Nuvem'}
            </h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </div>

        {!isConfigured ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                <AlertCircle size={17} />
                <span>Modo Local Ativo (Sem Supabase)</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
                As chaves de API do Supabase ainda não foram adicionadas ao arquivo <code>.env</code>.
                O Novitá MoneySync continuará salvando seus lançamentos localmente no navegador (IndexedDB).
              </p>
            </div>

            <div style={{ padding: '12px', background: '#f4f4f5', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#3f3f46' }}>
              <p style={{ margin: '0 0 6px 0', fontFamily: 'sans-serif', fontWeight: 600 }}>Para conectar a nuvem:</p>
              <p style={{ margin: '2px 0' }}>1. Crie o arquivo <code>.env</code></p>
              <p style={{ margin: '2px 0' }}>2. Adicione <code>VITE_SUPABASE_URL</code></p>
              <p style={{ margin: '2px 0' }}>3. Adicione <code>VITE_SUPABASE_ANON_KEY</code></p>
            </div>

            <button className="primary wide" onClick={onClose}>
              Continuar em Modo Local
            </button>
          </div>
        ) : user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#064e3b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '6px' }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Autenticado com Sucesso</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{user.email}</p>
              {user.user_metadata?.display_name && (
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#047857' }}>
                  Nome: {user.user_metadata.display_name}
                </p>
              )}
              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#059669', fontFamily: 'monospace' }}>
                ID: {user.id}
              </p>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#71717a' }}>
              Seus registros privados e grupos estão protegidos por Row Level Security no Supabase.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="delete wide"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleLogout}
                disabled={loading}
              >
                <LogOut size={16} />
                {loading ? 'Saindo...' : 'Desconectar'}
              </button>
              <button className="primary wide" onClick={onClose}>
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
              Acesse sua conta para sincronizar despesas entre celular e computador com segurança.
            </p>

            <div className="segmented">
              <button
                type="button"
                className={mode === 'login' ? 'selected' : ''}
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'selected' : ''}
                onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
              >
                Criar Conta
              </button>
              <button
                type="button"
                className={mode === 'magic' ? 'selected' : ''}
                onClick={() => { setMode('magic'); setError(''); setSuccessMsg(''); }}
              >
                Link Mágico
              </button>
            </div>

            {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
            {successMsg && (
              <div style={{ padding: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#064e3b', borderRadius: '8px', fontSize: '12px' }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mode === 'signup' && (
                <label>
                  <span>Seu nome ou apelido</span>
                  <input
                    type="text"
                    required
                    placeholder="Ex.: Jonas ou Cris"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </label>
              )}

              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>

              {mode !== 'magic' && (
                <label>
                  <span>Senha</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </label>
              )}

              <button className="primary wide" type="submit" disabled={loading} style={{ marginTop: '6px' }}>
                {loading
                  ? 'Processando...'
                  : mode === 'login'
                  ? 'Entrar no MoneySync'
                  : mode === 'signup'
                  ? 'Cadastrar e Conectar'
                  : 'Enviar Link de Acesso'}
              </button>
            </form>

            <div style={{ paddingTop: '8px', borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#71717a' }}>
              <span>🔒 Protegido com Supabase Auth</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#183f35', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                onClick={onClose}
              >
                Usar local sem login
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}