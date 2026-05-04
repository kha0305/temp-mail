const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const sqlFilePath = path.join(rootDir, 'deployment', 'sql', 'create-temp-mail-db.sql');

const loadBackendEnv = () => {
  const originalCwd = process.cwd();

  try {
    process.chdir(backendDir);
    return require(path.join(backendDir, 'src', 'config', 'env'));
  } finally {
    process.chdir(originalCwd);
  }
};

const escapeIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const getSqlContent = (databaseName) => {
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`SQL file not found: ${sqlFilePath}`);
  }

  return fs
    .readFileSync(sqlFilePath, 'utf8')
    .replace(/`temp_mail`/g, escapeIdentifier(databaseName));
};

const main = async () => {
  const env = loadBackendEnv();
  const mysql = require(require.resolve('mysql2/promise', { paths: [backendDir] }));
  const sql = getSqlContent(env.db.name);

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    ssl: env.db.ssl
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });

  try {
    await connection.query(sql);
    console.log(`Database "${env.db.name}" initialized successfully.`);
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error('Failed to initialize database.');
  console.error(error.message);
  process.exitCode = 1;
});
