import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

export function signToken(teacherId, email) {
  return jwt.sign({ teacherId, email }, SECRET, { expiresIn: '30d' });
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

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.teacherId) {
      return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
    }
    req.teacherId = payload.teacherId;
    req.teacherEmail = payload.email;
    return handler(req, res);
  };
}
