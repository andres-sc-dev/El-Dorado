// IP del cliente sin el prefijo IPv6 de IPv4 (::ffff:). Se guarda en login_history y audit_log.
function getClientIp(request) {
  return request.ip ? request.ip.replace('::ffff:', '') : null;
}

module.exports = { getClientIp };
