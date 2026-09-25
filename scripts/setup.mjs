import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  console.log('Existing .env preserved. The bootstrap account is created only for a new database.');
  process.exit(0);
}
const password = randomBytes(21).toString('base64url');
mkdirSync(resolve(root, 'data'), { recursive: true });
writeFileSync(envPath, [
  'HOST=127.0.0.1', 'PORT=4173', 'DATABASE_PATH=./data/cct.sqlite',
  'ADMIN_EMAIL=admin@cct.local', `ADMIN_PASSWORD=${password}`,
  'NODE_ENV=development', 'PUBLIC_ORIGIN=http://127.0.0.1:4173',
  'ALLOWED_ORIGINS=http://127.0.0.1:5173', ''
].join('\n'), { mode: 0o600 });
writeFileSync(resolve(root, 'LOCAL-ACCESS.md'), `# CCT 本机预览访问\n\n- 官网：http://127.0.0.1:4173\n- 管理后台：http://127.0.0.1:4173/admin\n- 初始管理员：admin@cct.local\n- 初始密码：\`${password}\`\n\n本文件和 .env 已加入 .gitignore，请勿公开、提交仓库或放入交付公开附件。首次登录后在“账号安全”修改密码，修改后本文件中的初始密码将失效。数据库首次创建时才读取初始账号配置。正式部署请使用独立账号、独立密码和 HTTPS。\n`, { mode: 0o600 });
console.log('Created local configuration and unique administrator password. Read LOCAL-ACCESS.md privately.');
