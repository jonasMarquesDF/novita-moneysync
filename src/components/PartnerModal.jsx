import React, { useState } from 'react';
import {
  Users,
  X,
  Share2,
  Phone,
  Mail,
  Copy,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import {
  findLocalUserByEmailOrPhone,
  linkPartner
} from '../db';

export function PartnerModal({ user, partner, onClose, onPartnerLinked, transfers = [] }) {
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [manualName, setManualName] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const appUrl = window.location.origin;
  const inviteCode = user?.partnerCode || user?.id?.slice(0, 8).toUpperCase() || 'SYNC-2026';

  const inviteMessage = `Oi! Criei nosso espaço financeiro no Novitá MoneySync para dividirmos nossas contas com clareza e sem crédito indevido. Conecte comigo informando meu e-mail (${user?.email}) ou código ${inviteCode} pelo link: ${appUrl}`;

  function handleSendWhatsAppInvite() {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;
    window.open(url, '_blank');
  }

  function handleCopyInvite() {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSearchResult(null);

    if (!query.trim()) return;
    setLoading(true);

    try {
      const found = await findLocalUserByEmailOrPhone(query);
      if (found) {
        if (found.email === user?.email) {
          throw new Error('Você não pode se conectar com a sua própria conta.');
        }
        setSearchResult(found);
      } else {
        // Não achou usuário já cadastrado, permite convidar/vincular prévio
        setSearchResult({
          isNew: true,
          emailOrPhone: query.trim()
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmLink(targetUser) {
    setLoading(true);
    setError('');
    try {
      let partnerData;
      if (targetUser.isNew) {
        if (!manualName.trim()) throw new Error('Informe o nome ou apelido do seu parceiro(a).');
        const isEmail = targetUser.emailOrPhone.includes('@');
        partnerData = await linkPartner(user.id, {
          name: manualName.trim(),
          email: isEmail ? targetUser.emailOrPhone : '',
          phone: isEmail ? '' : targetUser.emailOrPhone
        });
      } else {
        partnerData = await linkPartner(user.id, {
          name: targetUser.name,
          email: targetUser.email,
          phone: targetUser.phone
        });
      }

      setSuccess(`Parceria conectada com ${partnerData.name}!`);
      onPartnerLinked(partnerData);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="partner-title" style={{ maxWidth: '480px' }}>
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#183f35" />
            <h2 id="partner-title" style={{ margin: 0, fontSize: '20px' }}>
              {partner ? 'Parceria Conectada' : 'Encontrar Parceiro(a)'}
            </h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </div>

        <p className="muted" style={{ fontSize: '13px', margin: '4px 0 16px' }}>
          Divida gastos com o casal e acerte as contas do mês automaticamente.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#064e3b', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
            {success}
          </div>
        )}

        {/* Parceiro já conectado */}
        {partner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: '14px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>PARCEIRO(A) ATIVO</span>
                <span style={{ fontSize: '11px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>Sincronizado</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#064e3b' }}>{partner.name}</h3>
              {partner.email && <p style={{ margin: 0, fontSize: '12px', color: '#047857' }}>E-mail: {partner.email}</p>}
              {partner.phone && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#047857' }}>WhatsApp: {partner.phone}</p>}
            </div>

            {/* Ação para enviar resumo do mês no WhatsApp */}
            {transfers.length > 0 && (
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Resumo do Acerto do Mês
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const text = `Oi ${partner.name}! No Novitá MoneySync nosso acerto do mês ficou fechado em ${transfers.map(t => `${t.amount / 100} R$`).join(', ')}. Dá uma conferida no app!`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <MessageCircle size={18} />
                  Enviar Fechamento no WhatsApp
                </button>
              </div>
            )}

            <button
              className="delete wide"
              onClick={() => onPartnerLinked(null)}
              style={{ marginTop: '8px' }}
            >
              Desconectar Parceiro(a)
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Opção 1: Enviar Convite pelo WhatsApp */}
            <div style={{
              padding: '14px',
              borderRadius: '14px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#25D366',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'white'
                }}>
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#166534' }}>Convidar pelo WhatsApp</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#15803d' }}>
                    Envie o convite com seu código para o WhatsApp do seu parceiro(a).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSendWhatsAppInvite}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <MessageCircle size={16} />
                  Enviar no WhatsApp
                </button>

                <button
                  type="button"
                  onClick={handleCopyInvite}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: '#ffffff',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    borderRadius: '9px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Opção 2: Buscar por E-mail ou WhatsApp */}
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Ou localize pelo E-mail ou WhatsApp:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="E-mail ou WhatsApp com DDD"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                <button
                  type="submit"
                  className="primary"
                  disabled={loading}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Search size={16} />
                  Buscar
                </button>
              </div>
            </form>

            {/* Resultado da busca */}
            {searchResult && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {searchResult.isNew ? (
                  <>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        Parceiro ainda não cadastrado
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        Como devemos chamá-lo(a) nas contas divididas?
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="Nome do parceiro(a) (ex: Cris)"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                    <button
                      type="button"
                      className="primary wide"
                      onClick={() => handleConfirmLink(searchResult)}
                      disabled={loading || !manualName.trim()}
                    >
                      Vincular {manualName || 'Parceiro'} e Começar
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>{searchResult.name}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{searchResult.email}</p>
                      </div>
                      <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontWeight: 500 }}>
                        Encontrado
                      </span>
                    </div>
                    <button
                      type="button"
                      className="primary wide"
                      onClick={() => handleConfirmLink(searchResult)}
                      disabled={loading}
                    >
                      Conectar com {searchResult.name}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}