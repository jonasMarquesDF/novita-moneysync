import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Cloud,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  isConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword
} from '../supabase';
import {
  registerLocalUser,
  loginLocalUser,
  seedForUser
} from '../db';

export function AuthScreen({ onLogin, onExploreDemo }) {
  const [tab, setTab] = useState('signup'); // 'signup' | 'login'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Formatação amigável para telefone / WhatsApp
  function formatWhatsApp(val) {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (tab === 'signup') {
        if (!name.trim()) throw new Error('Por favor, informe seu nome ou apelido.');
        if (!email.trim() || !email.includes('@')) throw new Error('Informe um e-mail válido.');
        if (phone.replace(/\D/g, '').length < 10) throw new Error('Informe um número de WhatsApp com DDD válido.');
        if (password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');
        if (password !== confirmPassword) throw new Error('As senhas digitadas não coincidem.');

        let userObj = null;

        if (isConfigured) {
          // Registro via Supabase Cloud
          const data = await signUpWithEmailPassword(email, password, name, phone);
          if (data.user) {
            userObj = {
              id: data.user.id,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.replace(/\D/g, ''),
              partnerCode: data.user.id.slice(0, 8).toUpperCase(),
              provider: 'supabase'
            };
          } else {
            setNotice('Conta criada no Supabase! Verifique seu e-mail para confirmar antes de entrar.');
            setLoading(false);
            return;
          }
        } else {
          // Registro seguro local (IndexedDB criptografado SHA-256)
          userObj = await registerLocalUser({
            name,
            email,
            phone,
            password
          });
        }

        await seedForUser(userObj.id, userObj.name);
        onLogin(userObj);
      } else {
        // Fluxo de Login
        if (!email.trim()) throw new Error('Informe seu e-mail cadastrado.');
        if (!password) throw new Error('Informe sua senha.');

        let userObj = null;

        if (isConfigured) {
          const data = await signInWithEmailPassword(email, password);
          userObj = {
            id: data.user.id,
            name: data.user.user_metadata?.display_name || email.split('@')[0],
            email: data.user.email,
            phone: data.user.user_metadata?.phone || '',
            partnerCode: data.user.id.slice(0, 8).toUpperCase(),
            provider: 'supabase'
          };
        } else {
          userObj = await loginLocalUser({ email, password });
        }

        onLogin(userObj);
      }
    } catch (err) {
      setError(err.message || 'Falha ao processar autenticação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(180deg, #f4f6ee 0%, #e9ece0 100%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(24, 63, 53, 0.08)',
        border: '1px solid #e1e7d9'
      }}>
        {/* Marca / Topo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: '#183f35',
            color: '#dce6cc',
            fontSize: '26px',
            fontWeight: 'bold',
            fontFamily: 'serif',
            marginBottom: '12px',
            boxShadow: '0 8px 20px rgba(24, 63, 53, 0.2)'
          }}>
            N
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 650, color: '#183f35', margin: 0 }}>
            novitá<span style={{ color: '#688c5d', fontWeight: 400, marginLeft: '4px' }}>MoneySync</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#7b857b' }}>
            Finanças a dois com autonomia, clareza e sem crédito indevido.
          </p>
        </div>

        {/* Abas: Criar Conta vs Entrar */}
        <div className="segmented" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            className={tab === 'signup' ? 'selected' : ''}
            onClick={() => { setTab('signup'); setError(''); setNotice(''); }}
            style={{ fontWeight: tab === 'signup' ? 600 : 400 }}
          >
            Cadastrar Conta
          </button>
          <button
            type="button"
            className={tab === 'login' ? 'selected' : ''}
            onClick={() => { setTab('login'); setError(''); setNotice(''); }}
            style={{ fontWeight: tab === 'login' ? 600 : 400 }}
          >
            Já Tenho Conta
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#064e3b',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 550, color: '#334155' }}>
              <span>Como você quer ser chamado?</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="Ex.: Jonas, Cris, etc."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 38px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px'
                  }}
                />
                <User size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#94a3b8' }} />
              </div>
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 550, color: '#334155' }}>
            <span>E-mail</span>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px'
                }}
              />
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#94a3b8' }} />
            </div>
          </label>

          {tab === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 550, color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>WhatsApp com DDD</span>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 400 }}>Para envio de convites e acertos</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={e => setPhone(formatWhatsApp(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 38px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px'
                  }}
                />
                <Phone size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#16a34a' }} />
              </div>
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 550, color: '#334155' }}>
            <span>Senha</span>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px'
                }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#94a3b8' }} />
            </div>
          </label>

          {tab === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 550, color: '#334155' }}>
              <span>Confirmar Senha</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Repita a mesma senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 38px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px'
                  }}
                />
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#94a3b8' }} />
              </div>
            </label>
          )}

          <button
            type="submit"
            className="primary wide"
            disabled={loading}
            style={{
              marginTop: '10px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '15px'
            }}
          >
            {loading ? (
              <span>Salvando...</span>
            ) : tab === 'signup' ? (
              <>
                <span>Cadastrar e Começar</span>
                <ArrowRight size={18} />
              </>
            ) : (
              <>
                <span>Acessar Minha Conta</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Rodapé / Alternativa de Teste */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="#16a34a" />
            <span>Dados criptografados no cofre pessoal</span>
          </div>

          <button
            type="button"
            onClick={onExploreDemo}
            style={{
              background: 'none',
              border: 'none',
              color: '#183f35',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '12px',
              marginTop: '4px'
            }}
          >
            Explorar dados de demonstração (Jonas e Cris)
          </button>
        </div>
      </div>
    </div>
  );
}