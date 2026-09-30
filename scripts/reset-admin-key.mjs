import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resetAdminKey} from '../auth.mjs';
const root=process.env.LIBRARY_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const path=resetAdminKey(root);
console.log(`管理员密钥已重置，旧密钥及旧会话立即失效。请在本机打开 ${path} 获取新密钥；不要分享或公开上传此文件。`);
