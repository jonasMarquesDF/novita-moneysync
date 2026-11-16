import React, { useState } from 'react';
import {
  Users,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';
import {
  createGroup,
  updateGroup,
  deleteGroup,
  findUserByIdOrEmailOrCode,
  generateGroupCode
} from '../db';

export function GroupModal({ user, groupToEdit = null, onClose, onGroupSaved, onGroupDeleted }) {
  const isEditing = Boolean(groupToEdit);
  const [name, setName] = useState(groupToEdit?.name || '');
  const [defaultRule, setDefaultRule] = useState(groupToEdit?.defaultRule || 'equal');
  const [groupCode, setGroupCode] = useState(groupToEdit?.code || generateGroupCode(name || 'GRP'));

  // Pessoas do grupo
  const [members, setMembers] = useState(
    groupToEdit?.members || [
      { id: user?.id || 'me', name: `${user?.name || 'Você'} (Você)`, isCreator: true }
    ]
  );

  const [addMethod, setAddMethod] = useState('lookup'); // 'lookup' | 'whatsapp'
  const [searchQuery, setSearchQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchFound, setSearchFound] = useState(null);

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const appUrl = window.location.origin;
  const inviteMessage = `Oi! Criei o grupo "${name || 'Despesas'}" no Novitá MoneySync para dividirmos nossas contas. Entre usando o código ${groupCode} ou pelo link: ${appUrl}?join=${groupCode}`;

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

  async function handleSearchUser(e) {
    e.preventDefault();
    setSearchError('');
    setSearchFound(null);
    if (!searchQuery.trim()) return;

    try {
      const found = await findUserByIdOrEmailOrCode(searchQuery);
      if (found) {
        if (members.some(m => m.id === found.id)) {
          setSearchError('Esta pessoa já está adicionada no grupo.');
          return;
        }
        setSearchFound(found);
      } else {
        setSearchFound({
          isNew: true,
          query: searchQuery.trim()
        });
      }
    } catch (err) {
      setSearchError('Erro na busca: ' + err.message);
    }
  }

  function handleAddFoundUser() {
    if (!searchFound) return;
    if (searchFound.isNew) {
      if (!manualName.trim()) {
        setSearchError('Digite o nome da pessoa.');
        return;
      }
      setMembers([
        ...members,
        {
          id: `ext-${crypto.randomUUID().slice(0, 8)}`,
          name: manualName.trim(),
          email: searchFound.query.includes('@') ? searchFound.query : '',
          phone: searchFound.query.includes('@') ? '' : searchFound.query
        }
      ]);
    } else {
      setMembers([
        ...members,
        {
          id: searchFound.id,
          name: searchFound.name,
          email: searchFound.email,
          phone: searchFound.phone,
          partnerCode: searchFound.partnerCode
        }
      ]);
    }
    setSearchFound(null);
    setSearchQuery('');
    setManualName('');
    setSearchError('');
  }

  function handleRemoveMember(id) {
    if (id === user?.id || id === 'me') return;
    setMembers(members.filter(m => m.id !== id));
  }

  async function handleSaveGroup(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do grupo.');
      return;
    }
    if (members.length < 2) {
      setError('Adicione pelo menos mais uma pessoa que vai participar do grupo.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const cleanMembers = members.map(m => ({
        id: m.id,
        name: m.name.replace(' (Você)', ''),
        email: m.email || '',
        phone: m.phone || '',
        partnerCode: m.partnerCode || ''
      }));

      let saved;
      if (isEditing) {
        saved = await updateGroup(groupToEdit.id, {
          name: name.trim(),
          defaultRule,
          members: cleanMembers
        });
      } else {
        saved = await createGroup({
          name: name.trim(),
          defaultRule,
          members: cleanMembers,
          createdBy: user?.id || 'me'
        });
      }

      onGroupSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar grupo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o grupo "${groupToEdit.name}" e todas as suas despesas?`)) return;
    setBusy(true);
    try {
      await deleteGroup(groupToEdit.id);
      onGroupDeleted(groupToEdit.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="group-title" style={{ maxWidth: '480px' }}>
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#183f35" />
            <h2 id="group-title" style={{ margin: 0, fontSize: '20px' }}>
              {isEditing ? 'Editar Grupo' : 'Criar Grupo de Rateio'}
            </h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </div>

        <p className="muted" style={{ margin: '4px 0 16px', fontSize: '13px' }}>
          Defina o nome, a regra de rateio e as pessoas que vão participar.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', borderRadius: '10px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. Nome do Grupo */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <span>1. Nome do Grupo</span>
            <input
              type="text"
              required
              placeholder="Ex.: Viagem Guarajuba - BA, Despesas do Casal"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px' }}
            />
          </label>

          {/* 2. Regras de Rateio */}
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              2. Regra de Rateio do Grupo
            </span>
            <div className="segmented">
              <button
                type="button"
                className={defaultRule === 'equal' ? 'selected' : ''}
                onClick={() => setDefaultRule('equal')}
              >
                Partes Iguais (Rachar)
              </button>
              <button
                type="button"
                className={defaultRule === 'percent' ? 'selected' : ''}
                onClick={() => setDefaultRule('percent')}
              >
                Porcentagem (%)
              </button>
              <button
                type="button"
                className={defaultRule === 'fixed' ? 'selected' : ''}
                onClick={() => setDefaultRule('fixed')}
              >
                Cota Fixa
              </button>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
              {defaultRule === 'equal'
                ? 'Todas as despesas deste grupo serão divididas igualmente entre os participantes cadastrados.'
                : defaultRule === 'percent'
                ? 'Rateio baseado em percentuais definidos.'
                : 'Um participante paga valor fixo e os demais dividem o restante.'}
            </p>
          </div>

          {/* 3. Pessoas que vão participar do grupo */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                3. Pessoas que vão participar ({members.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Código do Grupo: <strong style={{ fontFamily: 'monospace' }}>{groupCode}</strong>
              </span>
            </div>

            {/* Lista de pessoas do grupo */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {members.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    fontSize: '12px',
                    color: '#064e3b'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  {m.id !== (user?.id || 'me') && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#047857' }}
                      title="Remover pessoa"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Alternar como adicionar pessoas */}
            <div className="segmented" style={{ marginBottom: '10px' }}>
              <button
                type="button"
                className={addMethod === 'lookup' ? 'selected' : ''}
                onClick={() => { setAddMethod('lookup'); setSearchFound(null); setSearchError(''); }}
                style={{ fontSize: '12px' }}
              >
                Buscar por ID, Código ou E-mail
              </button>
              <button
                type="button"
                className={addMethod === 'whatsapp' ? 'selected' : ''}
                onClick={() => { setAddMethod('whatsapp'); setSearchFound(null); setSearchError(''); }}
                style={{ fontSize: '12px', color: '#16a34a' }}
              >
                Convidar no WhatsApp
              </button>
            </div>

            {/* Adicionar por ID, Código ou E-mail */}
            {addMethod === 'lookup' && (
              <div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Digite ID, Código (ex: JONA-4821) ou E-mail"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSearchUser}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px', fontSize: '13px' }}
                  >
                    <Search size={15} /> Buscar
                  </button>
                </div>

                {searchError && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#b91c1c' }}>{searchError}</p>
                )}

                {searchFound && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {searchFound.isNew ? (
                      <>
                        <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                          Pessoa não localizada no cadastro. Como devemos chamá-la?
                        </p>
                        <input
                          type="text"
                          placeholder="Nome da pessoa (ex: Marcos, Fernanda)"
                          value={manualName}
                          onChange={e => setManualName(e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          className="primary"
                          onClick={handleAddFoundUser}
                          style={{ fontSize: '12px', padding: '8px' }}
                        >
                          Adicionar {manualName || 'Pessoa'} ao Grupo
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>{searchFound.name}</strong>
                          <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{searchFound.email || searchFound.partnerCode}</p>
                        </div>
                        <button
                          type="button"
                          className="primary"
                          onClick={handleAddFoundUser}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          Adicionar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Convidar no WhatsApp */}
            {addMethod === 'whatsapp' && (
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontSize: '12px', fontWeight: 600 }}>
                  <MessageCircle size={16} color="#25D366" />
                  <span>Envie o link para as pessoas entrarem no grupo:</span>
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
                      color: 'white',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <MessageCircle size={16} /> Enviar Convite no WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      background: 'white',
                      color: '#166534',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {isEditing && (
              <button
                type="button"
                className="delete"
                onClick={handleDelete}
                disabled={busy}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} /> Excluir Grupo
              </button>
            )}

            <button
              type="submit"
              className="primary wide"
              disabled={busy}
              style={{ height: '46px', fontSize: '14px' }}
            >
              {busy ? 'Salvando...' : isEditing ? 'Salvar Grupo' : 'Criar Grupo'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}