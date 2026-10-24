import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

export function signToken(teacherId, email) {
  return jwt.sign({ teacherId, email }, SECRET, { expiresIn: '30d' });
}

// Сурагчийн токен: зөвхөн studentId, code (багшийн API үүнийг хүлээж авахгүй — requireAuth)
export function signStudentToken(acc) {
  return jwt.sign({ studentId: acc.id, code: acc.code }, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Нэвтэрсэн + эрхийн хугацаа хүчинтэй (QPay). Дууссан бол 402 → клиент төлбөрийн дэлгэц гаргана.
export function requirePaid(handler) {
  return requireAuth(async (req, res) => {
    const { getTeacherById, hasAccess } = await import('./db');
    const t = await getTeacherById(req.teacherId);
    if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
    if (!hasAccess(t)) return res.status(402).json({ error: 'Эрхийн хугацаа дууссан', code: 'PAYMENT_REQUIRED' });
    return handler(req, res);
  });
}

// Сурагч (кодоороо нэвтэрсэн): сурагчийн токен + бүртгэл нь хэвээр байх ёстой → req.student
export function requireStudent(handler) {
  return async (req, res) => {
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.studentId) return res.status(401).json({ error: 'Кодоороо дахин нэвтэрнэ үү' });
    const { getStudentAccountById } = await import('./db');
    const acc = await getStudentAccountById(payload.studentId);
    if (!acc) return res.status(401).json({ error: 'Кодоороо дахин нэвтэрнэ үү' });
    req.student = acc;
    return handler(req, res);
  };
}

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    // Сурагчийн токенд ч teacherId байдаг тул studentId-тайг багшийнх гэж хүлээж авахгүй
    if (!payload?.teacherId || payload.studentId) {
      return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
    }
    req.teacherId = payload.teacherId;
    req.teacherEmail = payload.email;
    return handler(req, res);
  };
}
