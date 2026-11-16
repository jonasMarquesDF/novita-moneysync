// All financial arithmetic is in integer cents. No binary floating point totals.
export const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export function cents(raw){
 const s=String(raw).trim().replace(/\s|R\$/g,'');
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(s)) throw Error('Use um valor positivo, como 1700,00.');
 const [a,b='']=s.replace(',','.').split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<=0||n>99999999999) throw Error('Valor fora do limite.');return n;
}
function amount(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Centavos inválidos.');}
export function split(total,participants){
 amount(total);if(!participants.length||new Set(participants.map(p=>p.id)).size!==participants.length)throw Error('Participantes inválidos.');
 let fixed=0;const result={};const weighted=[];
 for(const p of participants){if(p.fixed!==undefined){amount(p.fixed);fixed+=p.fixed;result[p.id]=p.fixed;}else{if(!Number.isSafeInteger(p.weight)||p.weight<=0)throw Error('Peso inválido.');weighted.push(p);}}
 if(fixed>total||(!weighted.length&&fixed!==total))throw Error('Cotas não fecham o total.');
 const remaining=total-fixed, sum=weighted.reduce((s,p)=>s+p.weight,0);let used=0;
 const parts=weighted.map(p=>{const exact=remaining*p.weight/sum;const base=Math.floor(exact);used+=base;result[p.id]=base;return {id:p.id,remainder:exact-base};}).sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id));
 for(let i=0;i<remaining-used;i++)result[parts[i].id]++;
 return result;
}
export function installments(total,count,start){
 amount(total);if(!Number.isInteger(count)||count<1||count>360||total<count||!/^\d{4}-\d{2}$/.test(start))throw Error('Parcelamento inválido.');
 const [y,m]=start.split('-').map(Number);if(m<1||m>12)throw Error('Mês inválido.');
 return Array.from({length:count},(_,i)=>{const month=m-1+i;return {number:i+1,month:`${y+Math.floor(month/12)}-${String(month%12+1).padStart(2,'0')}`,amount:Math.floor(total/count)+(i<total%count?1:0)};});
}
// Unpaid obligations affect projected capital, but never create reimbursement credit.
export function balances(entries){const b={};for(const e of entries){if(!e.paid||e.scope!=='shared')continue;const shares=split(e.amount,e.participants);for(const [id,n] of Object.entries(shares))b[id]=(b[id]||0)-n;b[e.payer]=(b[e.payer]||0)+e.amount;}return b;}
export function settle(entries){const b=balances(entries);const creditors=Object.entries(b).filter(([,n])=>n>0).sort(([a],[c])=>a.localeCompare(c));const debtors=Object.entries(b).filter(([,n])=>n<0).map(([id,n])=>[id,-n]).sort(([a],[c])=>a.localeCompare(c));const transfers=[];let i=0,j=0;while(i<debtors.length&&j<creditors.length){const amount=Math.min(debtors[i][1],creditors[j][1]);transfers.push({from:debtors[i][0],to:creditors[j][0],amount});debtors[i][1]-=amount;creditors[j][1]-=amount;if(!debtors[i][1])i++;if(!creditors[j][1])j++;}return transfers;}
export function monthly(entries,user,month){let income=0,obligation=0;for(const e of entries.filter(e=>e.month===month)){if(e.scope==='private'&&e.owner!==user)continue;if(e.kind==='income'){income+=e.amount;continue;}obligation+=e.scope==='shared'?(split(e.amount,e.participants)[user]||0):e.amount;}return {income,obligation,free:income-obligation};}

// Status de Vencimento e Alertas de Pagamento em Dia
export function getDueStatus(entry, todayStr = new Date().toISOString().slice(0, 10)) {
  if (entry.paid) {
    return { status: 'paid', label: 'Pago', color: '#059669', bg: '#ecfdf5', icon: 'check' };
  }
  if (!entry.dueDay && !entry.dueDate) {
    return { status: 'none', label: 'Pendente', color: '#d97706', bg: '#fef3c7', icon: 'clock' };
  }
  const dueDate = entry.dueDate || `${entry.month}-${String(entry.dueDay).padStart(2, '0')}`;
  const tDate = new Date(todayStr + 'T00:00:00');
  const dDate = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((dDate - tDate) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'overdue', label: `Atrasada (${Math.abs(diffDays)}d)`, color: '#e11d48', bg: '#fff1f2', icon: 'alert', diffDays };
  }
  if (diffDays === 0) {
    return { status: 'today', label: 'Vence HOJE!', color: '#ea580c', bg: '#fff7ed', icon: 'alert', diffDays };
  }
  if (diffDays <= 5) {
    return { status: 'soon', label: `Vence em ${diffDays}d (Dia ${entry.dueDay})`, color: '#d97706', bg: '#fefce8', icon: 'clock', diffDays };
  }
  return { status: 'upcoming', label: `Vence dia ${entry.dueDay}`, color: '#64748b', bg: '#f1f5f9', icon: 'calendar', diffDays };
}

// Projeta despesas recorrentes (todo mês) nos meses seguintes
export function projectEntriesForMonth(entries, targetMonth) {
  const result = [];
  const exactMonthEntries = entries.filter(e => e.month === targetMonth);
  result.push(...exactMonthEntries);

  const recurrents = entries.filter(e => e.frequency === 'recurrent' && e.month < targetMonth);
  recurrents.forEach(rec => {
    const alreadyExists = exactMonthEntries.some(e => (rec.seriesId && e.seriesId === rec.seriesId) || (e.description === rec.description && e.owner === rec.owner));
    if (!alreadyExists) {
      const dueDay = rec.dueDay || 10;
      result.push({
        ...rec,
        id: `${rec.id}-${targetMonth}`,
        month: targetMonth,
        dueDay,
        dueDate: `${targetMonth}-${String(dueDay).padStart(2, '0')}`,
        paid: false
      });
    }
  });

  return result;
}
