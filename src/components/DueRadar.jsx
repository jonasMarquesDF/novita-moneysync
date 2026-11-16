import React from 'react';
import { money, getDueStatus } from '../engine';
import {
  CalendarDays,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export function DueRadar({ entries = [], onTogglePaid }) {
  const expenses = entries.filter(e => e.kind === 'expense');
  if (expenses.length === 0) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const paidCount = expenses.filter(e => e.paid).length;
  const totalCount = expenses.length;
  const onTimePct = Math.round((paidCount / totalCount) * 100);

  // Classifica despesas pelo status de vencimento
  const overdueList = [];
  const todayList = [];
  const soonList = [];

  expenses.forEach(e => {
    if (e.paid) return;
    const st = getDueStatus(e, todayStr);
    if (st.status === 'overdue') overdueList.push({ ...e, dueInfo: st });
    else if (st.status === 'today') todayList.push({ ...e, dueInfo: st });
    else if (st.status === 'soon') soonList.push({ ...e, dueInfo: st });
  });

  const urgentCount = overdueList.length + todayList.length;

  function handleSendReminder(e) {
    const st = getDueStatus(e, todayStr);
    const text = `🔔 *Lembrete de Pagamento MoneySync*\nConta: *${e.description}*\nValor: *${money(e.amount)}*\nVencimento: *Dia ${e.dueDay || e.month}* (${st.label})\n${e.pixKey ? `Chave PIX: ${e.pixKey}\n` : ''}\nVamos acertar para manter tudo em dia?`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      marginBottom: '20px'
    }}>
      {/* Topo do Radar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: urgentCount > 0 ? '#fff1f2' : '#ecfdf5',
            color: urgentCount > 0 ? '#e11d48' : '#059669',
            display: 'grid',
            placeItems: 'center'
          }}>
            <CalendarDays size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#1e293b' }}>
              Radar de Vencimentos & Pagamento em Dia
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              {paidCount} de {totalCount} despesas pagas ({onTimePct}% do mês quitado)
            </p>
          </div>
        </div>

        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: onTimePct === 100 ? '#059669' : onTimePct >= 50 ? '#d97706' : '#e11d48',
          background: onTimePct === 100 ? '#ecfdf5' : onTimePct >= 50 ? '#fefce8' : '#fff1f2',
          padding: '4px 10px',
          borderRadius: '12px'
        }}>
          {onTimePct}% em dia
        </span>
      </div>

      {/* Barra de Progresso de Quitação */}
      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          width: `${onTimePct}%`,
          height: '100%',
          background: onTimePct === 100 ? '#10b981' : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
          borderRadius: '4px',
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Alertas Urgentes ou Tudo em Dia */}
      {urgentCount > 0 || soonList.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Vencidas */}
          {overdueList.map(e => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#fff1f2',
                border: '1px solid #ffe4e6'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#e11d48',
                  background: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #fecdd3'
                }}>
                  {e.dueInfo.label}
                </span>
                <div>
                  <strong style={{ fontSize: '13px', color: '#881337' }}>{e.description}</strong>
                  <span style={{ fontSize: '11px', color: '#be123c', marginLeft: '6px' }}>({money(e.amount)})</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSendReminder(e)}
                  title="Lembrar no WhatsApp"
                  style={{
                    background: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MessageCircle size={13} /> Lembrar
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePaid(e)}
                  style={{
                    background: '#ffffff',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Dar Baixa
                </button>
              </div>
            </div>
          ))}

          {/* Vence Hoje */}
          {todayList.map(e => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#fff7ed',
                border: '1px solid #ffedd5'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ea580c',
                  background: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa'
                }}>
                  Vence Hoje
                </span>
                <div>
                  <strong style={{ fontSize: '13px', color: '#9a3412' }}>{e.description}</strong>
                  <span style={{ fontSize: '11px', color: '#c2410c', marginLeft: '6px' }}>({money(e.amount)})</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTogglePaid(e)}
                style={{
                  background: '#ea580c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Pagar Agora
              </button>
            </div>
          ))}

          {/* Vence nos próximos dias */}
          {soonList.map(e => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '10px',
                background: '#fefce8',
                border: '1px solid #fef9c3',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} color="#d97706" />
                <span style={{ color: '#854d0e', fontWeight: 500 }}>
                  {e.description} · {money(e.amount)}
                </span>
              </div>
              <span style={{ color: '#d97706', fontWeight: 600, fontSize: '11px' }}>
                {e.dueInfo.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#064e3b',
          fontSize: '13px'
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span><strong>Tudo em dia!</strong> Nenhuma conta vencida ou pendente para hoje neste mês.</span>
        </div>
      )}
    </div>
  );
}