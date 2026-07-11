const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({ userId, role, action, entity, entityId, details = {} }) => {
  try {
    const log = new AuditLog({
      user: userId,
      role,
      action,
      entity,
      entityId,
      details
    });
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
};

module.exports = { createAuditLog };
