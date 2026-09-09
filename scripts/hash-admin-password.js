/**
 * Genera un hash bcrypt para una contraseña de admin.
 *
 * Uso:
 *   node scripts/hash-admin-password.js "mi_contraseña_segura"
 *
 * Luego copiá el hash generado en tu .env.local:
 *   ADMIN_1_PASSWORD=$2b$12$...
 *   ADMIN_2_PASSWORD=$2b$12$...
 *
 * El sistema soporta tanto hashes bcrypt (recomendado) como texto plano (legacy).
 */

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Uso: node scripts/hash-admin-password.js \"tu_contraseña\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nHash bcrypt generado:");
console.log(hash);
console.log("\nCopiá este valor en tu .env.local como ADMIN_1_PASSWORD o ADMIN_2_PASSWORD");
