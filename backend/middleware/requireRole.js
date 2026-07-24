// Must run after requireAuth (needs req.user already set). Factory so routes can declare which
// roles are allowed inline: requireRole('Admin', 'Analyst').
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Not authorized', data: null })
    }
    next()
  }
}
