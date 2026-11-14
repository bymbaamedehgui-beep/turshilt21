// Сургуулийн эрх (components/SchoolPage.js). Сургууль хичээлээ төлж (pages/api/pay/create.js {school:true, subjects}), багш нараа урина.
// GET → { school, licenses, members, memberOf, invites, access }
// POST {action:'create', name} — сургууль үүсгэнэ (нэг данс — нэг сургууль); {action:'rename', name}
// POST {action:'invite', contact} — багшийг утас (8 орон) эсвэл имэйлээр урина; {action:'remove', memberId}
// POST {action:'accept'|'decline', memberId} — урилгад хариулна; {action:'leave', schoolId} — сургуулиас гарна.
// Урилгыг багш өөрөө зөвшөөрсний дараа л сургуулийн эрхийг ашиглаж, сургууль түүний шалгалтыг нэгдсэн жагсаалтад харна.
import crypto from 'crypto';
import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById, getSchoolByOwner, createSchool, renameSchool, schoolLicenses, schoolMembers, inviteMember,
  removeMember, acceptInvite, declineInvite, leaveSchool, getAccessInfo } from '../../../lib/db';
import { normalizePhone } from '../../../lib/verifymn';

const MAX_MEMBERS = 200;
const newId = p => p + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
const digits8 = p => String(p || '').replace(/\D/g, '').slice(-8);
// Утас → 8 оронтой дугаар, имэйл → жижиг үсгээр; буруу бол null
function normContact(raw) {
  const s = String(raw || '').trim();
  if (s.includes('@')) { const e = s.toLowerCase(); return e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null; }
  const p = normalizePhone(s);
  return p ? p.local : null;
}
const memberView = m => ({ id: m.id, contact: m.contact, status: m.status, createdAt: m.created_at, joinedAt: m.joined_at,
  teacher: m.teacher_id ? { name: m.name || '', email: m.email || '' } : null });

async function state(t, school) {
  const [licenses, members, access] = await Promise.all([
    school ? schoolLicenses(school.id) : [], school ? schoolMembers(school.id) : [], getAccessInfo(t)]);
  return {
    school: school ? { id: school.id, name: school.name, createdAt: school.created_at } : null,
    licenses: licenses.map(l => ({ subject: l.subject, until: l.until })),
    members: members.map(memberView),
    memberOf: access.memberOf.map(s => ({ ...s,
      licenses: access.licenses.filter(l => l.school?.id === s.id).map(l => ({ subject: l.subject, until: l.until })) })),
    invites: access.invites,
    access,
  };
}

export default requireAuth(async function handler(req, res) {
  await initDb();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });
  let school = await getSchoolByOwner(t.id);
  if (req.method === 'GET') return res.json(await state(t, school));
  if (req.method !== 'POST') return res.status(405).end();

  const a = req.body?.action;
  const ownerOnly = () => { if (school) return false; res.status(403).json({ error: 'Зөвхөн сургуулийн эзэн хийнэ' }); return true; };
  if (a === 'create') {
    if (school) return res.status(409).json({ error: 'Та аль хэдийн сургууль үүсгэсэн байна' });
    const name = cleanName(req.body?.name);
    if (name.length < 2) return res.status(400).json({ error: 'Сургуулийн нэрээ оруулна уу' });
    school = await createSchool({ id: newId('S'), name, ownerId: t.id });
    if (!school) return res.status(409).json({ error: 'Та аль хэдийн сургууль үүсгэсэн байна' });
    return res.json(await state(t, school));
  }
  if (a === 'rename') {
    if (ownerOnly()) return;
    const name = cleanName(req.body?.name);
    if (name.length < 2) return res.status(400).json({ error: 'Сургуулийн нэрээ оруулна уу' });
    school = await renameSchool(school.id, name);
    return res.json(await state(t, school));
  }
  if (a === 'invite') {
    if (ownerOnly()) return;
    const contact = normContact(req.body?.contact);
    if (!contact) return res.status(400).json({ error: 'Утасны дугаар (8 оронтой) эсвэл имэйл буруу байна' });
    if (contact === String(t.email || '').toLowerCase() || contact === digits8(t.phone))
      return res.status(400).json({ error: 'Та сургуулийн эзэн — өөрийгөө урих шаардлагагүй' });
    if ((await schoolMembers(school.id)).length >= MAX_MEMBERS) return res.status(400).json({ error: `Нэг сургуульд ${MAX_MEMBERS} хүртэл багш` });
    if (!(await inviteMember(school.id, { id: newId('M'), contact }))) return res.status(409).json({ error: 'Энэ хүнийг аль хэдийн урьсан байна' });
    return res.json(await state(t, school));
  }
  if (a === 'remove') {
    if (ownerOnly()) return;
    if (!(await removeMember(school.id, String(req.body?.memberId || '')))) return res.status(404).json({ error: 'Олдсонгүй' });
    return res.json(await state(t, school));
  }
  if (a === 'accept' || a === 'decline') {
    const id = String(req.body?.memberId || '');
    const ok = a === 'accept' ? await acceptInvite(t, id) : await declineInvite(t, id);
    if (!ok) return res.status(404).json({ error: 'Урилга олдсонгүй' });
    return res.json(await state(t, school));
  }
  if (a === 'leave') {
    if (!(await leaveSchool(t.id, String(req.body?.schoolId || '')))) return res.status(404).json({ error: 'Олдсонгүй' });
    return res.json(await state(t, school));
  }
  return res.status(400).json({ error: 'Үйлдэл буруу' });
});
