import Dexie from 'dexie';

export const db = new Dexie('novita-moneysync-v4');

db.version(1).stores({
  entries: 'id,month,scope,owner,groupId',
  settings: 'key',
  users: 'id,email,phone,partnerCode',
  partners: 'id,userId,email,phone',
  groups: 'id,code,createdBy,category'
});

async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generatePartnerCode(name) {
  const prefix = (name || 'USER').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export function generateGroupCode(name) {
  const prefix = (name || 'GRP').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'G');
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export async function saveEntries(entries) {
  await db.entries.bulkPut(entries);
}

// Registro local seguro
export async function registerLocalUser({ name, email, phone, password }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

  const existing = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();
  if (existing) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const partnerCode = generatePartnerCode(name);

  const user = {
    id,
    name: name.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    partnerCode,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  await db.users.put(user);
  await setCurrentSessionUser(user);
  return user;
}

// Login local seguro
export async function loginLocalUser({ email, password }) {
  const cleanEmail = email.trim().toLowerCase();
  const user = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();

  if (!user) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    throw new Error('E-mail ou senha inválidos.');
  }

  await setCurrentSessionUser(user);
  return user;
}

export async function setCurrentSessionUser(user) {
  if (user) {
    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      partnerCode: user.partnerCode
    };
    localStorage.setItem('moneysync_session', JSON.stringify(sessionData));
    await db.settings.put({ key: 'active_session', value: sessionData });
  } else {
    localStorage.removeItem('moneysync_session');
    await db.settings.delete('active_session');
  }
}

export async function getCurrentSessionUser() {
  try {
    const local = localStorage.getItem('moneysync_session');
    if (local) return JSON.parse(local);
    const dbSession = await db.settings.get('active_session');
    return dbSession?.value || null;
  } catch {
    return null;
  }
}

export async function logoutUserSession() {
  await setCurrentSessionUser(null);
}

// Busca de usuário por ID, Código ou E-mail
export async function findUserByIdOrEmailOrCode(query) {
  if (!query) return null;
  const clean = query.trim().toLowerCase();
  const cleanUpper = query.trim().toUpperCase();

  let user = await db.users.where('id').equals(query.trim()).first();
  if (!user) {
    user = await db.users.where('email').equalsIgnoreCase(clean).first();
  }
  if (!user) {
    user = await db.users.filter(u => u.partnerCode && u.partnerCode.toUpperCase() === cleanUpper).first();
  }
  if (!user && clean.replace(/\D/g, '').length >= 8) {
    const digits = clean.replace(/\D/g, '');
    user = await db.users.filter(u => u.phone && u.phone.includes(digits)).first();
  }

  if (user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      partnerCode: user.partnerCode
    };
  }
  return null;
}

// ==========================================
// Grupos 100% Dinâmicos (Criar, Editar, Excluir)
// ==========================================

export async function getGroups(userId) {
  if (!userId) return [];
  const list = await db.groups.toArray();
  return list.filter(g => g.createdBy === userId || g.members.some(m => m.id === userId));
}

export async function createGroup({ name, category, icon, defaultRule, members, createdBy }) {
  const id = crypto.randomUUID();
  const code = generateGroupCode(name);
  const now = new Date().toISOString();

  const group = {
    id,
    code,
    name: name.trim(),
    category: category || 'outros',
    icon: icon || '👥',
    defaultRule: defaultRule || 'equal',
    members: members || [],
    createdBy,
    createdAt: now,
    updatedAt: now
  };

  await db.groups.put(group);
  return group;
}

export async function updateGroup(id, updates) {
  const existing = await db.groups.get(id);
  if (!existing) throw new Error('Grupo não encontrado.');

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await db.groups.put(updated);
  return updated;
}

export async function deleteGroup(id) {
  await db.groups.delete(id);
  // Remove também as despesas deste grupo
  await db.entries.where('groupId').equals(id).delete();
}

export async function getGroupByCode(code) {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  const group = await db.groups.where('code').equalsIgnoreCase(cleanCode).first();
  return group || null;
}

export async function joinGroupByCode(code, user) {
  const group = await getGroupByCode(code);
  if (!group) throw new Error('Código de grupo inválido.');

  // Verifica se o usuário já é membro
  const alreadyMember = group.members.some(m => m.id === user.id || (user.email && m.email === user.email));
  if (alreadyMember) return group;

  group.members.push({
    id: user.id,
    name: user.name,
    email: user.email || '',
    phone: user.phone || ''
  });

  group.updatedAt = new Date().toISOString();
  await db.groups.put(group);
  return group;
}

// Inicialização sem grupos prontos (mantém apenas lançamento de receita inicial se usuário desejar)
export async function seedForUser(userId, userName) {
  // Não cria grupos pré-fabricados. O usuário é livre para criar os seus próprios.
  const existingEntries = await db.entries.where('owner').equals(userId).count();
  if (existingEntries > 0) return;

  const month = new Date().toISOString().slice(0, 7);
  await db.entries.put({
    id: crypto.randomUUID(),
    description: 'Receita inicial',
    amount: 500000,
    month,
    kind: 'income',
    scope: 'private',
    owner: userId,
    paid: true
  });
}
// Aliases e Helpers de Parceria
export const findLocalUserByEmailOrPhone = findUserByIdOrEmailOrCode;

export async function getConnectedPartner(userId) {
  if (!userId) return null;
  const partner = await db.partners.where('userId').equals(userId).first();
  return partner || null;
}

export async function linkPartner(userId, { name, email, phone }) {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  const partnerRecord = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    connectedAt: new Date().toISOString()
  };

  const existing = await db.partners.where('userId').equals(userId).first();
  if (existing) {
    partnerRecord.id = existing.id;
  }

  await db.partners.put(partnerRecord);
  return partnerRecord;
}
