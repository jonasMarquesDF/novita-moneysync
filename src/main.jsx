import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  House,
  Wallet,
  Users,
  ChevronRight,
  ShieldCheck,
  X,
  Check,
  CalendarDays,
  Download,
  Trash2,
  User,
  LogOut,
  MessageCircle,
  UserPlus,
  Settings,
  CreditCard,
  Layers,
  Sparkles,
  Bot
} from 'lucide-react';
import {
  db,
  saveEntries,
  getCurrentSessionUser,
  logoutUserSession,
  getConnectedPartner,
  seedForUser,
  getGroups,
  deleteGroup,
  joinGroupByCode
} from './db';
import { money, cents, split, installments, settle, monthly, getDueStatus, projectEntriesForMonth } from './engine';
import { isConfigured, getCurrentUser, logOut } from './supabase';
import { isAiConfigured, analyzeFinancesWithAi, askGemini } from './ai';
import { AuthScreen } from './components/AuthScreen';
import { PartnerModal } from './components/PartnerModal';
import { AuthModal } from './components/AuthModal';
import { GroupModal } from './components/GroupModal';
import { DueRadar } from './components/DueRadar';
import { DonutExpenseChart, GroupBalanceChart, BudgetHealthMeter } from './components/InteractiveCharts';
import './style.css';

const today = () => new Date().toLocaleDateString('sv-SE');

function App() {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [tab, setTab] = useState('home');
  const [entries, setEntries] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));

  const [modal, setModal] = useState(false);
  const [partnerModal, setPartnerModal] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiAdvice, setAiAdvice] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Carrega usuário da sessão ao iniciar e verifica convites de URL (?join=CODE)
  useEffect(() => {
    async function initAuth() {
      try {
        let loggedUser = null;

        if (isConfigured) {
          const cloudUser = await getCurrentUser();
          if (cloudUser) {
            loggedUser = {
              id: cloudUser.id,
              name: cloudUser.user_metadata?.display_name || cloudUser.email.split('@')[0],
              email: cloudUser.email,
              phone: cloudUser.user_metadata?.phone || '',
              partnerCode: cloudUser.id.slice(0, 8).toUpperCase(),
              provider: 'supabase'
            };
          }
        }

        if (!loggedUser) {
          loggedUser = await getCurrentSessionUser();
        }

        if (loggedUser) {
          setUser(loggedUser);
          const p = await getConnectedPartner(loggedUser.id);
          setPartner(p);
          await seedForUser(loggedUser.id, loggedUser.name);

          // Verifica se veio de um link de convite (?join=CODE)
          const params = new URLSearchParams(window.location.search);
          const joinCode = params.get('join');
          if (joinCode) {
            try {
              const joined = await joinGroupByCode(joinCode, loggedUser);
              setNotice(`Você entrou no grupo "${joined.name}" via convite do WhatsApp!`);
              setActiveGroupId(joined.id);
              window.history.replaceState({}, '', window.location.pathname);
            } catch (err) {
              console.warn('Convite inválido:', err);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar sessão:', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    initAuth();
  }, []);

  const refresh = async () => {
    if (!user) return;
    const all = await db.entries.toArray();
    const userEntries = all.filter(e => e.owner === user.id || e.owner === 'jonas' || e.owner === 'me' || isDemoMode);
    setEntries(userEntries);

    const grps = await getGroups(user.id);
    setGroups(grps);
    if (grps.length > 0 && (!activeGroupId || !grps.some(g => g.id === activeGroupId))) {
      setActiveGroupId(grps[0].id);
    }
  };

  useEffect(() => {
    if (user) {
      refresh().catch(() => setError('Não foi possível carregar os dados.'));
    }
  }, [user, isDemoMode]);

  if (loadingInitial) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f5f5ee' }}>
        <p style={{ color: '#183f35', fontSize: '15px' }}>Carregando Novitá MoneySync...</p>
      </div>
    );
  }

  // Se não estiver logado nem em modo demo, abre a tela de cadastro e login
  if (!user && !isDemoMode) {
    return (
      <AuthScreen
        onLogin={async loggedUser => {
          setUser(loggedUser);
          setIsDemoMode(false);
          const p = await getConnectedPartner(loggedUser.id);
          setPartner(p);
          await seedForUser(loggedUser.id, loggedUser.name);
        }}
        onExploreDemo={async () => {
          const demoUser = { id: 'demo-jonas', name: 'Jonas', email: 'jonas@exemplo.com' };
          setIsDemoMode(true);
          setUser(demoUser);
          setPartner({ id: 'demo-cris', name: 'Cris', email: 'cris@exemplo.com' });
          await seedForUser(demoUser.id, 'Jonas');
        }}
      />
    );
  }

  const myId = user?.id || 'me';
  const myName = user?.name || 'Você';
  const partnerName = partner?.name || 'Parceiro';

  // Grupo ativo
  const activeGroup = groups.find(g => g.id === activeGroupId) || null;

  // Nomes mapeados do grupo ativo
  const names = { [myId]: myName, me: myName, jonas: myName };
  if (activeGroup?.members) {
    activeGroup.members.forEach(m => {
      names[m.id] = m.name;
    });
  }

  const monthRows = projectEntriesForMonth(entries, month);
  const s = monthly(monthRows, myId, month);

  // Lançamentos específicos do grupo ativo
  const groupRows = activeGroup
    ? monthRows.filter(e => e.scope === 'shared' && e.groupId === activeGroup.id)
    : [];
  const groupTransfers = settle(groupRows);

  async function paid(e) {
    try {
      await db.entries.update(e.id, { paid: !e.paid });
      await refresh();
    } catch {
      setError('Não foi possível salvar.');
    }
  }

  async function remove(e) {
    if (!confirm('Excluir somente este lançamento/parcela?')) return;
    await db.entries.delete(e.id);
    refresh();
  }

  async function handleLogout() {
    if (!confirm('Deseja realmente sair da sua conta?')) return;
    if (isConfigured) {
      await logOut().catch(console.warn);
    }
    await logoutUserSession();
    setUser(null);
    setPartner(null);
    setIsDemoMode(false);
  }

  function backup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 4, user, partner, groups, entries }, null, 2)], { type: 'application/json' }));
    a.download = `moneysync-backup-${myName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice('Backup exportado com sucesso.');
  }

  function handleSendGroupWhatsAppSettlement() {
    if (!groupTransfers.length || !activeGroup) return;
    const lines = groupTransfers.map(t => `👉 ${names[t.from] || t.from} deve pagar ${money(t.amount)} para ${names[t.to] || t.to}`);
    const text = `🌴 *Fechamento: ${activeGroup.name}* (Novitá MoneySync)\n\nSegue o resumo de acertos do grupo:\n${lines.join('\n')}\n\n✅ Todos os valores calculados em centavos sem sobras.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  const userInitials = myName.slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav>
          {[
            ['home', House, 'Visão geral'],
            ['private', Wallet, 'Minhas finanças'],
            ['shared', Users, 'Compartilhados']
          ].map(([id, Icon, label]) => (
            <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>
              <Icon size={22} />
              {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0 10px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => { setGroupToEdit(null); setGroupModal(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#e0e7ff',
              color: '#3730a3',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            Novo Grupo de Rateio
          </button>

          <button
            onClick={() => setPartnerModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#eef2e6',
              color: '#183f35',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Users size={16} />
            {partner ? partner.name : 'Conectar Parceiro'}
          </button>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>

        <div className="sidebar-foot">
          <ShieldCheck />
          <p>Seu dinheiro.<br /><strong>Suas escolhas.</strong></p>
        </div>
      </aside>

      <main>
        <header>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="desktop-crumb">
            Olá, <strong>{myName}</strong> <ChevronRight size={15} />{' '}
            {tab === 'home'
              ? 'Visão geral'
              : tab === 'private'
              ? 'Minhas finanças'
              : activeGroup
              ? `Grupo: ${activeGroup.name}`
              : 'Compartilhados'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { setGroupToEdit(null); setGroupModal(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '14px',
                background: '#e0e7ff',
                color: '#3730a3',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Novo Grupo
            </button>

            <button
              className="avatar"
              title={`Conta: ${user?.email || myName}`}
              onClick={() => setAuthModal(true)}
            >
              {userInitials}
            </button>
          </div>
        </header>

        <section className="content">
          <div className="title-row">
            <div>
              <p className="eyebrow">CONTROLE FINANCEIRO DINÂMICO</p>
              <h1>
                {tab === 'home'
                  ? `Tudo em equilíbrio, ${myName}.`
                  : tab === 'private'
                  ? 'Seu espaço individual.'
                  : activeGroup
                  ? `${activeGroup.icon || '👥'} ${activeGroup.name}`
                  : 'Grupos de Rateio'}
              </h1>
              <p className="muted">
                {tab === 'home'
                  ? 'Visão geral com infográficos interativos e previsão do seu mês.'
                  : tab === 'private'
                  ? 'Receitas e despesas individuais, em um só lugar.'
                  : activeGroup
                  ? 'Controle transparente de rateio entre os participantes do grupo.'
                  : 'Crie grupos de despesas para dividir contas com amigos ou casal.'}
              </p>
            </div>
            <label className="month">
              <CalendarDays size={19} />
              <input
                aria-label="Mês de referência"
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
              />
            </label>
          </div>

          {error && <p role="alert" className="error">{error}</p>}
          {notice && <p role="status" className="notice" onClick={() => setNotice('')}>{notice}</p>}

          {/* ABA HOME (VISÃO GERAL COM INFOGRÁFICOS) */}
          {tab === 'home' ? (
            <>
              {/* Infográfico 1: Termômetro de Saúde Financeira */}
              <div style={{ marginBottom: '22px' }}>
                <BudgetHealthMeter
                  income={s.income}
                  obligation={s.obligation}
                  free={s.free}
                />
              </div>

              {/* Estatísticas e Donut Chart */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '22px', marginBottom: '22px' }}>
                {/* Infográfico 2: Donut Chart Interativo */}
                <DonutExpenseChart
                  entries={monthRows}
                  title="Distribuição dos Gastos do Mês"
                />

                <div className="stats" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Stat
                    icon={ArrowDownLeft}
                    label="Receitas do mês"
                    value={money(s.income)}
                    detail="Somente suas receitas"
                  />
                  <Stat
                    icon={ArrowUpRight}
                    label="Suas obrigações"
                    value={money(s.obligation)}
                    detail="Individuais + suas cotas em grupos"
                  />
                </div>
              </div>

              {/* Botão de Análise e Consultoria com IA (Google Gemini) */}
              {isAiConfigured && (
                <div style={{
                  marginBottom: '22px',
                  background: 'linear-gradient(135deg, #183f35 0%, #245e50 100%)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 6px 20px rgba(24, 63, 53, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}>
                      <Sparkles size={22} color="#a7f3d0" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Consultor Financeiro IA <span style={{ fontSize: '11px', background: '#059669', color: '#ecfdf5', padding: '2px 8px', borderRadius: '12px' }}>Gemini Ativo</span>
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#d1fae5' }}>
                        Clique para analisar suas despesas, ver dicas de economia e alertas de vencimento.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setShowAiModal(true);
                      if (!aiAdvice) {
                        setAiLoading(true);
                        try {
                          const advice = await analyzeFinancesWithAi(monthRows, { name: myName });
                          setAiAdvice(advice);
                        } catch (err) {
                          setAiAdvice(`Erro ao consultar IA: ${err.message}`);
                        } finally {
                          setAiLoading(false);
                        }
                      }
                    }}
                    style={{
                      background: '#ecfdf5',
                      color: '#064e3b',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    <Sparkles size={16} /> Analisar Mês
                  </button>
                </div>
              )}

              {/* Radar de Vencimentos e Pagamento em Dia */}
              <div style={{ marginBottom: '22px' }}>
                <DueRadar
                  entries={monthRows}
                  onTogglePaid={paid}
                />
              </div>
            </>
          ) : null}

          {/* ABA COMPARTILHADOS (GRUPOS 100% DINÂMICOS) */}
          {tab === 'shared' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Barra de Seleção de Grupos ou Estado Vazio */}
              {groups.length === 0 ? (
                <div style={{
                  padding: '36px 20px',
                  borderRadius: '20px',
                  background: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <Users size={28} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
                      Nenhum grupo de rateio criado ainda
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', maxWidth: '420px' }}>
                      Crie seu primeiro grupo (ex.: Viagem, Casal ou Amigos) definindo o nome, regra de rateio e as pessoas para começar a dividir despesas.
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => { setGroupToEdit(null); setGroupModal(true); }}
                    style={{ marginTop: '8px', padding: '10px 20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Plus size={18} /> Criar Primeiro Grupo
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '6px'
                  }}>
                    {groups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setActiveGroupId(g.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: activeGroupId === g.id ? '2px solid #10b981' : '1px solid #cbd5e1',
                          background: activeGroupId === g.id ? '#ecfdf5' : '#ffffff',
                          color: activeGroupId === g.id ? '#064e3b' : '#334155',
                          fontWeight: activeGroupId === g.id ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: activeGroupId === g.id ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
                        }}
                      >
                        <span>{g.icon || '👥'}</span>
                        <span>{g.name}</span>
                        <small style={{ fontSize: '10px', color: '#64748b' }}>({g.members?.length || 1})</small>
                      </button>
                    ))}

                    <button
                      onClick={() => { setGroupToEdit(null); setGroupModal(true); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        border: '1px dashed #94a3b8',
                        background: '#f8fafc',
                        color: '#475569',
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={16} /> Novo Grupo
                    </button>
                  </div>

                  {activeGroup && (
                    <>
                      {/* Cabeçalho do Grupo com Botão de Edição */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 18px',
                        background: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '24px' }}>{activeGroup.icon || '👥'}</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{activeGroup.name}</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                              Rateio: <strong>{activeGroup.defaultRule === 'equal' ? 'Partes Iguais' : activeGroup.defaultRule === 'percent' ? 'Percentual' : 'Cota Fixa'}</strong> · Código: <strong style={{ fontFamily: 'monospace' }}>{activeGroup.code}</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => { setGroupToEdit(activeGroup); setGroupModal(true); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Settings size={15} /> Editar Grupo
                        </button>
                      </div>

                      {/* Infográfico do Grupo: Liquidômetro */}
                      <GroupBalanceChart
                        members={activeGroup.members || []}
                        entries={groupRows}
                        groupName={activeGroup.name}
                      />

                      {/* Card de Acerto e Notificação no WhatsApp */}
                      <section className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="section-head">
                          <div>
                            <p className="eyebrow">{activeGroup.name.toUpperCase()}</p>
                            <h3 style={{ margin: '4px 0 0' }}>Acerto de Contas do Grupo</h3>
                          </div>
                          {groupTransfers.length > 0 && (
                            <button
                              onClick={handleSendGroupWhatsAppSettlement}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#25D366',
                                color: 'white',
                                border: 'none',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <MessageCircle size={16} /> Enviar Acerto no WhatsApp
                            </button>
                          )}
                        </div>

                        <div style={{ marginTop: '14px' }}>
                          {groupTransfers.length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {groupTransfers.map((t, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    background: '#ffffff',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0'
                                  }}
                                >
                                  <span style={{ fontSize: '13px', color: '#1e293b' }}>
                                    <strong>{names[t.from] || t.from}</strong> deve pagar para <strong>{names[t.to] || t.to}</strong>
                                  </span>
                                  <strong style={{ fontSize: '15px', color: '#059669' }}>
                                    {money(t.amount)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                              Nenhum valor a compensar neste grupo no momento.
                            </p>
                          )}
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TABELA DE LANÇAMENTOS */}
          <section className="card transactions">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  {tab === 'shared' && activeGroup ? `DESPESAS DE: ${activeGroup.name.toUpperCase()}` : 'MOVIMENTAÇÕES'}
                </p>
                <h3>
                  {tab === 'home'
                    ? 'O mês em detalhes'
                    : tab === 'private'
                    ? 'Minhas movimentações'
                    : activeGroup
                    ? `Lançamentos de ${activeGroup.name}`
                    : 'Lançamentos Compartilhados'}
                </h3>
              </div>
              <button className="primary" onClick={() => setModal(true)}>
                <Plus size={19} /> Novo lançamento
              </button>
            </div>

            {monthRows.filter(e => tab === 'home' || (tab === 'private' ? e.scope === 'private' : (e.scope === 'shared' && (!activeGroup || e.groupId === activeGroup.id)))).length === 0 ? (
              <div className="empty">
                <Wallet />
                <h3>Nenhum lançamento encontrado.</h3>
                <p>Toque em "Novo lançamento" para registrar uma despesa ou receita.</p>
              </div>
            ) : (
              <div className="rows">
                {monthRows
                  .filter(e => tab === 'home' || (tab === 'private' ? e.scope === 'private' : (e.scope === 'shared' && (!activeGroup || e.groupId === activeGroup.id))))
                  .map(e => (
                    <article className="transaction" key={e.id}>
                      <div className={'transaction-icon ' + (e.kind === 'income' ? 'income' : '')}>
                        {e.kind === 'income' ? <ArrowDownLeft size={23} /> : e.scope === 'shared' ? <Users size={23} /> : <Wallet size={23} />}
                      </div>
                      <div className="transaction-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong>{e.description}</strong>
                          {e.frequency === 'recurrent' && (
                            <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                              Todo Mês
                            </span>
                          )}
                          {e.kind === 'expense' && e.dueDay && !e.paid && (
                            (() => {
                              const st = getDueStatus(e);
                              return (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  background: st.bg,
                                  color: st.color,
                                  border: `1px solid ${st.color}40`
                                }}>
                                  {st.label}
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <span>
                          {e.scope === 'shared'
                            ? `Dividido em ${e.participants?.length || 2} pessoas · Pago por ${names[e.payer] || e.payer}`
                            : 'Individual · somente você'}
                          {e.number ? ` · ${e.number}/${e.count}` : ''}
                        </span>
                      </div>
                      <div className="transaction-value">
                        <strong className={e.kind === 'income' ? 'green' : ''}>
                          {e.kind === 'income' ? '+ ' : ''}{money(e.amount)}
                        </strong>
                        <button onClick={() => paid(e)} className={'status ' + (e.paid ? 'paid' : '')}>
                          {e.paid ? <><Check size={13} /> {e.kind === 'income' ? 'Recebido' : 'Pago'}</> : 'Pendente'}
                        </button>
                      </div>
                      <button aria-label={'Excluir ' + e.description} className="delete" onClick={() => remove(e)}>
                        <Trash2 size={16} />
                      </button>
                    </article>
                  ))}
              </div>
            )}
          </section>

          <footer>
            <span>
              <ShieldCheck size={16} />
              Conectado como {user?.email || myName}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => { setGroupToEdit(null); setGroupModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={15} /> Grupos
              </button>
              <button onClick={backup} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={15} /> Backup
              </button>
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#991b1b' }}>
                <LogOut size={15} /> Sair
              </button>
            </div>
          </footer>
        </section>
      </main>

      <button className="fab" aria-label="Novo lançamento" onClick={() => setModal(true)}>
        <Plus size={27} />
      </button>

      <nav className="bottom-nav">
        {[
          ['home', House, 'Visão geral'],
          ['private', Wallet, 'Minhas finanças'],
          ['shared', Users, 'Compartilhados']
        ].map(([id, Icon, label]) => (
          <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>
            <Icon size={23} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {modal && (
        <EntryModal
          month={month}
          myId={myId}
          myName={myName}
          groups={groups}
          activeGroupId={activeGroupId}
          onOpenGroupModal={() => { setModal(false); setGroupToEdit(null); setGroupModal(true); }}
          onClose={() => setModal(false)}
          onSave={async data => {
            await saveEntries(data);
            await refresh();
            setModal(false);
            setNotice('Lançamento salvo com sucesso.');
          }}
        />
      )}

      {partnerModal && (
        <PartnerModal
          user={user}
          partner={partner}
          transfers={groupTransfers}
          onClose={() => setPartnerModal(false)}
          onPartnerLinked={linked => {
            setPartner(linked);
            refresh();
            setNotice(linked ? `Parceria com ${linked.name} configurada!` : 'Parceiro desconectado.');
          }}
        />
      )}

      {groupModal && (
        <GroupModal
          user={user}
          groupToEdit={groupToEdit}
          onClose={() => { setGroupModal(false); setGroupToEdit(null); }}
          onGroupSaved={savedGrp => {
            refresh();
            setActiveGroupId(savedGrp.id);
            setNotice(`Grupo "${savedGrp.name}" salvo com sucesso!`);
          }}
          onGroupDeleted={delId => {
            refresh();
            setNotice('Grupo excluído com sucesso.');
          }}
        />
      )}

      {authModal && (
        <AuthModal
          user={user}
          onClose={() => setAuthModal(false)}
          onAuthSuccess={u => {
            setUser(u);
            if (!u) {
              setPartner(null);
              setIsDemoMode(false);
            }
          }}
        />
      )}

      {/* Modal do Consultor IA (Google Gemini) */}
      {showAiModal && (
        <div className="backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#183f35' }}>Diagnóstico Financeiro IA</h3>
                  <small style={{ color: '#64748b' }}>Google Gemini 2.5 Flash</small>
                </div>
              </div>
              <button aria-label="Fechar" className="close" onClick={() => setShowAiModal(false)}>
                <X size={19} />
              </button>
            </div>

            <div style={{ padding: '16px 0', minHeight: '140px' }}>
              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '30px 0' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>O Gemini está analisando suas despesas...</p>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px', color: '#334155' }}>
                  {aiAdvice}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <button
                type="button"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const advice = await analyzeFinancesWithAi(monthRows, { name: myName });
                    setAiAdvice(advice);
                  } catch (err) {
                    setAiAdvice(`Erro ao atualizar: ${err.message}`);
                  } finally {
                    setAiLoading(false);
                  }
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Atualizar Análise
              </button>
              <button
                className="primary"
                onClick={() => setShowAiModal(false)}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">N</span>
      <div>
        novitá<span>MoneySync</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <section className="card stat">
      <span className="soft-icon"><Icon size={21} /></span>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{detail}</small>
      </div>
    </section>
  );
}

// ========================================================
// Modal de Lançamento Simplificado e Direto ao Ponto
// ========================================================
function EntryModal({ month, myId, myName, groups, activeGroupId, onOpenGroupModal, onClose, onSave }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState(groups.length > 0 ? 'shared' : 'private');
  const [kind, setKind] = useState('expense');
  const [paymentType, setPaymentType] = useState('single'); // 'single' (único) | 'installments' (parcelado) | 'recurrent' (todo mês)
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [dueDay, setDueDay] = useState(10);
  const [pixKey, setPixKey] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(activeGroupId || groups[0]?.id || '');
  const [preview, setPreview] = useState(null);

  // Pega o grupo selecionado
  const currentGroup = groups.find(g => g.id === selectedGroupId) || groups[0] || null;
  const [rule, setRule] = useState(currentGroup?.defaultRule || 'equal');

  // As pessoas já foram adicionadas no grupo!
  const groupMembers = currentGroup?.members || [{ id: myId, name: myName }];
  const [payerId, setPayerId] = useState(myId);

  // Sincroniza a regra padrão quando muda de grupo
  useEffect(() => {
    if (currentGroup) {
      setRule(currentGroup.defaultRule || 'equal');
    }
  }, [selectedGroupId]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const f = new FormData(event.currentTarget);
      const total = cents(f.get('amount'));
      const isRecurrent = paymentType === 'recurrent';
      const count = kind === 'income' || paymentType === 'single' || isRecurrent ? 1 : Number(installmentsCount);
      const start = f.get('month');
      const selectedDay = Number(dueDay) || 10;

      let participants;
      if (scope === 'shared') {
        if (!currentGroup) throw Error('Crie um grupo de rateio primeiro.');

        // Se for partes iguais: divide entre todas as pessoas já cadastradas no grupo
        if (rule === 'equal') {
          participants = groupMembers.map(m => ({ id: m.id, weight: 1 }));
        } else if (rule === 'fixed') {
          const fixedCents = cents(f.get('share'));
          participants = [
            { id: groupMembers[1]?.id || 'partner', fixed: fixedCents },
            { id: myId, weight: 1 }
          ];
        } else {
          // Porcentagem
          const weight = Number(f.get('share'));
          if (!Number.isInteger(weight) || weight < 1 || weight > 99) {
            throw Error('Use um percentual de 1 a 99.');
          }
          participants = [
            { id: myId, weight },
            { id: groupMembers[1]?.id || 'partner', weight: 100 - weight }
          ];
        }
        split(total, participants);
      }

      const plan = installments(total, count, start);
      const seriesId = crypto.randomUUID();

      const data = plan.map(p => ({
        id: crypto.randomUUID(),
        seriesId,
        groupId: scope === 'shared' ? selectedGroupId : undefined,
        description: String(f.get('description')).trim(),
        amount: p.amount,
        number: p.number,
        count,
        month: p.month,
        dueDay: selectedDay,
        dueDate: `${p.month}-${String(selectedDay).padStart(2, '0')}`,
        frequency: isRecurrent ? 'recurrent' : (count > 1 ? 'installment' : 'single'),
        pixKey: String(pixKey).trim(),
        kind,
        scope: kind === 'income' ? 'private' : scope,
        owner: myId,
        payer: String(payerId),
        paid: f.get('paid') === 'on',
        participants: participants?.map(x =>
          x.fixed !== undefined
            ? { ...x, fixed: Math.floor(x.fixed / count) + (p.number <= (x.fixed % count) ? 1 : 0) }
            : x
        )
      }));

      data.forEach(e => {
        if (e.scope === 'shared') split(e.amount, e.participants);
      });

      if (!data[0].description) throw Error('Informe a descrição da despesa.');
      setPreview(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmSave() {
    setBusy(true);
    try {
      await onSave(preview);
    } catch {
      setError('Falha ao salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  // Notificar despesa específica via WhatsApp
  function handleShareExpenseWhatsApp() {
    if (!preview || !currentGroup) return;
    const item = preview[0];
    const shares = split(item.amount, item.participants);
    const individualShare = shares[groupMembers[0].id] || 0;
    const payerName = groupMembers.find(m => m.id === item.payer)?.name || 'Eu';

    const text = `💸 *Despesa: ${item.description}*\nGrupo: ${currentGroup.name}\nValor Total: ${money(item.amount)}${item.count > 1 ? ` (${item.count}x de ${money(item.amount)})` : ''}\nDivisão: ${money(individualShare)} por pessoa (${groupMembers.length} pessoas)\nPago por: ${payerName}\n\n✅ Registrado no Novitá MoneySync!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ maxWidth: '500px' }}>
        <div className="section-head">
          <h2 id="modal-title">{preview ? 'Confira antes de salvar' : 'Nova Despesa / Lançamento'}</h2>
          <button aria-label="Fechar" onClick={onClose}><X /></button>
        </div>
        <p className="muted">
          {preview ? 'Controle exato de centavos e rateio.' : 'Preencha o valor, parcelamento e grupo de divisão.'}
        </p>
        {error && <p className="error" role="alert">{error}</p>}

        {preview ? (
          <div className="preview">
            <h3>{preview[0].description}</h3>
            <p>
              {preview[0].count === 1 ? 'Pagamento Único (À vista)' : `${preview.length} parcela(s)`} · {preview[0].scope === 'shared' ? `Grupo: ${currentGroup?.name}` : 'Individual'}
            </p>
            {preview.map(e => {
              const shares = e.scope === 'shared' ? split(e.amount, e.participants) : {};
              return (
                <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{e.month} {e.count > 1 ? `(${e.number}/${e.count})` : ''}</span>
                    <span>{money(e.amount)}</span>
                  </div>
                  {e.scope === 'shared' && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Cota por pessoa: {money(shares[groupMembers[0].id] || 0)} cada ({groupMembers.length} pessoas do grupo)
                    </div>
                  )}
                </div>
              );
            })}

            {/* Compartilhar despesa no WhatsApp */}
            {preview[0].scope === 'shared' && (
              <button
                type="button"
                onClick={handleShareExpenseWhatsApp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  background: '#25D366',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                <MessageCircle size={18} />
                Compartilhar esta Despesa no WhatsApp
              </button>
            )}

            <button className="primary" disabled={busy} onClick={confirmSave} style={{ marginTop: '8px' }}>
              {busy ? 'Salvando…' : 'Confirmar e Salvar no App'}
            </button>
            <button onClick={() => setPreview(null)}>Voltar e editar</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Tipo: Despesa ou Receita */}
            <div className="segmented">
              <button
                type="button"
                className={kind === 'expense' ? 'selected' : ''}
                onClick={() => setKind('expense')}
              >
                Despesa
              </button>
              <button
                type="button"
                className={kind === 'income' ? 'selected' : ''}
                onClick={() => {
                  setKind('income');
                  setScope('private');
                }}
              >
                Receita
              </button>
            </div>

            {/* Descrição */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <span>Descrição da despesa</span>
              <input autoFocus required name="description" maxLength={120} placeholder="Ex.: Hospedagem, Compras do Mês, Jantar" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
            </label>

            {/* Valor e Mês */}
            <div className="form-grid">
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Valor total (R$)</span>
                <input name="amount" required inputMode="decimal" placeholder="0,00" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Mês de referência</span>
                <input type="month" name="month" defaultValue={month} required style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
              </label>
            </div>

            {/* Pagamento Único vs Parcelado vs Recorrente */}
            {kind === 'expense' && (
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Frequência / Tipo de Pagamento:
                </span>
                <div className="segmented">
                  <button
                    type="button"
                    className={paymentType === 'single' ? 'selected' : ''}
                    onClick={() => setPaymentType('single')}
                  >
                    À vista
                  </button>
                  <button
                    type="button"
                    className={paymentType === 'installments' ? 'selected' : ''}
                    onClick={() => setPaymentType('installments')}
                  >
                    Parcelado
                  </button>
                  <button
                    type="button"
                    className={paymentType === 'recurrent' ? 'selected' : ''}
                    onClick={() => setPaymentType('recurrent')}
                  >
                    Todo Mês (Fixo)
                  </button>
                </div>

                {paymentType === 'installments' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Quantidade de parcelas:</span>
                      <input
                        type="number"
                        min="2"
                        max="360"
                        value={installmentsCount}
                        onChange={e => setInstallmentsCount(e.target.value)}
                        style={{ width: '90px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}
                        required
                      />
                    </label>
                  </div>
                )}

                {/* Dia de Vencimento e Pagamento em Dia */}
                <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      Dia do Vencimento (1 a 31):
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dueDay}
                      onChange={e => setDueDay(e.target.value)}
                      style={{ width: '70px', padding: '6px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '14px', fontWeight: 700 }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20, 25].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDueDay(d)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: Number(dueDay) === d ? '1px solid #183f35' : '1px solid #cbd5e1',
                          background: Number(dueDay) === d ? '#183f35' : '#ffffff',
                          color: Number(dueDay) === d ? '#ffffff' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Dia {d}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#475569' }}>
                      <span>Chave PIX para cobrança/lembrete (opcional):</span>
                      <input
                        type="text"
                        placeholder="CPF, celular, e-mail ou aleatória"
                        value={pixKey}
                        onChange={e => setPixKey(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Quem participa */}
            {kind === 'expense' && (
              <>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Quem participa?
                  </span>
                  <div className="segmented">
                    <button
                      type="button"
                      className={scope === 'shared' ? 'selected' : ''}
                      onClick={() => setScope('shared')}
                    >
                      Grupo de Rateio
                    </button>
                    <button
                      type="button"
                      className={scope === 'private' ? 'selected' : ''}
                      onClick={() => setScope('private')}
                    >
                      Somente Eu ({myName})
                    </button>
                  </div>
                </div>

                {scope === 'shared' && (
                  <>
                    {groups.length === 0 ? (
                      <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', fontSize: '12px', color: '#92400e' }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>Você ainda não criou nenhum grupo.</p>
                        <button
                          type="button"
                          className="primary"
                          onClick={onOpenGroupModal}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          Criar Grupo de Rateio
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {/* Seletor do Grupo */}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                          <span>Selecione o Grupo:</span>
                          <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
                          >
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>
                                {g.icon || '👥'} {g.name} ({g.members?.length || 1} pessoas)
                              </option>
                            ))}
                          </select>
                        </label>

                        {/* Pessoas já adicionadas no grupo */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                            Pessoas que vão dividir (já adicionadas neste grupo):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {groupMembers.map(m => (
                              <span
                                key={m.id}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '16px',
                                  background: '#ecfdf5',
                                  color: '#064e3b',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  border: '1px solid #a7f3d0'
                                }}
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Forma de dividir */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                            Forma de Dividir:
                          </span>
                          <div className="segmented">
                            <button
                              type="button"
                              className={rule === 'equal' ? 'selected' : ''}
                              onClick={() => setRule('equal')}
                              style={{ fontSize: '12px' }}
                            >
                              Partes Iguais ({groupMembers.length} pessoas)
                            </button>
                            <button
                              type="button"
                              className={rule === 'percent' ? 'selected' : ''}
                              onClick={() => setRule('percent')}
                              style={{ fontSize: '12px' }}
                            >
                              Porcentagem
                            </button>
                            <button
                              type="button"
                              className={rule === 'fixed' ? 'selected' : ''}
                              onClick={() => setRule('fixed')}
                              style={{ fontSize: '12px' }}
                            >
                              Cota Fixa
                            </button>
                          </div>
                        </div>

                        {rule === 'percent' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                            <span>Sua porcentagem (%)</span>
                            <input name="share" inputMode="decimal" defaultValue="50" required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </label>
                        )}

                        {rule === 'fixed' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                            <span>Cota fixa de {groupMembers[1]?.name || 'Parceiro'} (R$)</span>
                            <input name="share" inputMode="decimal" placeholder="0,00" required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </label>
                        )}

                        {/* Quem pagou */}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                          <span>Quem pagou essa despesa do bolso?</span>
                          <select
                            value={payerId}
                            onChange={e => setPayerId(e.target.value)}
                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                          >
                            {groupMembers.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.id === myId ? '(Você)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Checkbox de pago */}
            <label className="checkbox" style={{ fontSize: '13px' }}>
              <input type="checkbox" name="paid" defaultChecked />{' '}
              {kind === 'income' ? 'Já recebi este valor' : 'Esta despesa já foi paga'}
            </label>

            <button className="primary wide" type="submit" style={{ marginTop: '6px', height: '46px' }}>
              Conferir e Salvar <ChevronRight size={18} />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '16px', border: '1px solid #fee2e2', color: '#991b1b', fontFamily: 'sans-serif' }}>
          <h2 style={{ marginTop: 0 }}>Ocorreu uma falha ao renderizar a tela</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>{this.state.error?.message || 'Erro inesperado'}</p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 18px', background: '#183f35', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Limpar cache e recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
