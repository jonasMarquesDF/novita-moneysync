import React, { useState } from 'react';
import { money, split } from '../engine';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

const PALETTE = [
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#f43f5e', // Rose Coral
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6'  // Teal
];

// ========================================================
// 1. Gráfico Donut / Rosquinha Interativa em SVG com Cores Vivas
// ========================================================
export function DonutExpenseChart({ entries = [], title = 'Distribuição das Despesas' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const expenses = entries.filter(e => e.kind === 'expense');
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  if (total === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Nenhuma despesa para exibir no gráfico neste mês.
      </div>
    );
  }

  // Agrupa despesas para o gráfico (top 5 + outros)
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  const slices = [];
  let otherSum = 0;

  sorted.forEach((e, idx) => {
    if (idx < 5) {
      slices.push({
        id: e.id,
        label: e.description,
        amount: e.amount,
        color: PALETTE[idx % PALETTE.length]
      });
    } else {
      otherSum += e.amount;
    }
  });

  if (otherSum > 0) {
    slices.push({
      id: 'others',
      label: 'Outras despesas',
      amount: otherSum,
      color: '#94a3b8'
    });
  }

  // Geometria SVG para o Donut
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      padding: '22px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#1e293b' }}>{title}</h4>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '12px' }}>
          Total: {money(total)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {slices.map((slice, i) => {
              const percent = slice.amount / total;
              const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
              const strokeDashoffset = -circumference * cumulativePercent;
              cumulativePercent += percent;
              const isHovered = hoveredIdx === i;

              return (
                <circle
                  key={slice.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    filter: isHovered ? 'drop-shadow(0 0 6px rgba(0,0,0,0.2))' : 'none'
                  }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Centro do Donut com informações no Hover */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            {activeSlice ? (
              <>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeSlice.label}
                </span>
                <strong style={{ fontSize: '14px', color: activeSlice.color, fontWeight: 700 }}>
                  {money(activeSlice.amount)}
                </strong>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {Math.round((activeSlice.amount / total) * 100)}%
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Despesas</span>
                <strong style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>
                  {money(total)}
                </strong>
                <span style={{ fontSize: '10px', color: '#10b981' }}>{slices.length} itens</span>
              </>
            )}
          </div>
        </div>

        {/* Legenda Lateral Interativa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px', flex: 1 }}>
          {slices.map((slice, i) => {
            const isHovered = hoveredIdx === i;
            const pct = Math.round((slice.amount / total) * 100);

            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  background: isHovered ? '#f8fafc' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: slice.color,
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: isHovered ? '#0f172a' : '#475569',
                    fontWeight: isHovered ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px'
                  }}>
                    {slice.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{money(slice.amount)}</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', width: '26px', textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========================================================
// 2. Liquidômetro e Balanço Visual do Grupo (Viagens e Amigos)
// ========================================================
export function GroupBalanceChart({ members = [], entries = [], groupName = 'Grupo' }) {
  const [activeUser, setActiveUser] = useState(null);

  // Calcula quanto cada membro pagou e qual a sua cota consumida
  const stats = {};
  members.forEach(m => {
    stats[m.id] = { name: m.name, paid: 0, obligation: 0 };
  });

  entries.forEach(e => {
    if (!e.paid || e.scope !== 'shared') return;
    if (stats[e.payer]) {
      stats[e.payer].paid += e.amount;
    }
    const shares = split(e.amount, e.participants);
    Object.entries(shares).forEach(([id, amt]) => {
      if (stats[id]) {
        stats[id].obligation += amt;
      }
    });
  });

  const memberList = Object.entries(stats).map(([id, data]) => ({
    id,
    name: data.name,
    paid: data.paid,
    obligation: data.obligation,
    net: data.paid - data.obligation // > 0 credor (a receber), < 0 devedor (a pagar)
  }));

  const maxVal = Math.max(...memberList.map(m => Math.max(m.paid, m.obligation)), 100);

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      padding: '22px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#1e293b' }}>
            Balanço de Gastos: {groupName}
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Comparativo entre o valor pago do bolso vs. cota justa de cada membro
          </p>
        </div>
        <span style={{ fontSize: '11px', color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
          {memberList.length} participantes
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {memberList.map((m, idx) => {
          const paidPct = Math.round((m.paid / maxVal) * 100);
          const obligPct = Math.round((m.obligation / maxVal) * 100);
          const isCreditor = m.net > 0;
          const isDebtor = m.net < 0;

          return (
            <div
              key={m.id}
              style={{
                padding: '12px',
                borderRadius: '14px',
                background: '#f8fafc',
                border: '1px solid #edf2f7',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: PALETTE[idx % PALETTE.length],
                    color: 'white',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>{m.name}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCreditor && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '3px 8px',
                      borderRadius: '8px'
                    }}>
                      Recebe {money(m.net)}
                    </span>
                  )}
                  {isDebtor && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#e11d48',
                      background: '#fff1f2',
                      padding: '3px 8px',
                      borderRadius: '8px'
                    }}>
                      Paga {money(-m.net)}
                    </span>
                  )}
                  {!isCreditor && !isDebtor && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Equilibrado</span>
                  )}
                </div>
              </div>

              {/* Barras Comparativas: Pago vs Cota */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '65px', color: '#64748b', fontSize: '10px' }}>Pagou:</span>
                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${paidPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <strong style={{ width: '75px', textAlign: 'right', color: '#047857' }}>{money(m.paid)}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '65px', color: '#64748b', fontSize: '10px' }}>Sua parte:</span>
                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${obligPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <strong style={{ width: '75px', textAlign: 'right', color: '#4338ca' }}>{money(m.obligation)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========================================================
// 3. Termômetro Visual de Saúde Orçamentária & Capital Livre
// ========================================================
export function BudgetHealthMeter({ income = 0, obligation = 0, free = 0 }) {
  const commitPct = income > 0 ? Math.min(100, Math.round((obligation / income) * 100)) : 0;

  // Cor dinâmica baseada no comprometimento
  const statusColor = commitPct <= 50 ? '#10b981' : commitPct <= 75 ? '#f59e0b' : '#f43f5e';
  const statusLabel = commitPct <= 50 ? 'Excelente (Folga para poupar)' : commitPct <= 75 ? 'Atenção (Zona moderada)' : 'Sobrecarga (Ajustar prioridades)';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: '20px',
      padding: '22px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color={statusColor} />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#1e293b' }}>
            Termômetro de Renda & Capital Livre
          </h4>
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: statusColor,
          background: `${statusColor}18`,
          padding: '3px 10px',
          borderRadius: '12px'
        }}>
          {commitPct}% comprometido
        </span>
      </div>

      {/* Barra do Termômetro com Gradiente Vivo */}
      <div style={{ position: 'relative', marginTop: '10px', marginBottom: '24px' }}>
        <div style={{
          height: '14px',
          borderRadius: '10px',
          background: 'linear-gradient(90deg, #10b981 0%, #10b981 45%, #f59e0b 65%, #f43f5e 90%)',
          position: 'relative',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)'
        }}>
          {/* Marcador de posição */}
          <div style={{
            position: 'absolute',
            left: `calc(${commitPct}% - 8px)`,
            top: '-5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ffffff',
            border: `3px solid ${statusColor}`,
            boxShadow: `0 0 10px ${statusColor}66`,
            display: 'grid',
            placeItems: 'center',
            transition: 'left 0.4s ease'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} />
          </div>
        </div>

        {/* Marcadores das Zonas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
          <span>0% (Livre)</span>
          <span>50% (Ideal)</span>
          <span>75% (Alerta)</span>
          <span>100% (Limite)</span>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #d1fae5' }}>
          <span style={{ fontSize: '11px', color: '#047857', fontWeight: 500 }}>Capital Livre Previsto</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: '#064e3b', fontWeight: 700 }}>
            {money(free)}
          </h3>
          <small style={{ fontSize: '10px', color: '#059669' }}>Disponível para novos planos</small>
        </div>

        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
          <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 500 }}>Total de Obrigações</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: '#991b1b', fontWeight: 700 }}>
            {money(obligation)}
          </h3>
          <small style={{ fontSize: '10px', color: '#dc2626' }}>Individuais + rateios</small>
        </div>
      </div>
    </div>
  );
}