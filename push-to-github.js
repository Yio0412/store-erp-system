// GitHub API file uploader - pushes all files to a repo via REST API
// Usage: node push-to-github.js <TOKEN>

const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.argv[2];
const OWNER = 'Yio0412';
const REPO = 'store-erp-system';
const BRANCH = 'main';
const PROJECT_DIR = __dirname;

if (!TOKEN) {
  console.error('Usage: node push-to-github.js <GITHUB_TOKEN>');
  process.exit(1);
}

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ERP-Deploy-Script',
        'Content-Type': 'application/json',
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (d) => chunks += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, data: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getAllFiles(dir, base = dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === '.git' || item === 'node_modules' || item === '.workbuddy') continue;
    const fullPath = path.join(dir, item);
    const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, base));
    } else {
      results.push({ path: relPath, fullPath });
    }
  }
  return results;
}

async function main() {
  console.log('Getting current commit SHA...');
  const refRes = await apiRequest('GET', `/git/refs/heads/${BRANCH}`);
  if (refRes.status !== 200) {
    console.error('Failed to get ref:', refRes.status, refRes.data);
    process.exit(1);
  }
  const currentSha = refRes.data.object.sha;
  console.log('Current SHA:', currentSha);

  const commitRes = await apiRequest('GET', `/git/commits/${currentSha}`);
  const treeSha = commitRes.data.tree.sha;
  console.log('Tree SHA:', treeSha);

  const files = getAllFiles(PROJECT_DIR);
  console.log(`Found ${files.length} files to upload`);

  // Create blobs for each file
  const treeItems = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const content = fs.readFileSync(f.fullPath);
    const contentBase64 = content.toString('base64');

    const blobRes = await apiRequest('POST', '/git/blobs', {
      content: contentBase64,
      encoding: 'base64',
    });

    if (blobRes.status !== 201) {
      console.error(`Failed to create blob for ${f.path}:`, blobRes.status);
      continue;
    }

    treeItems.push({
      path: f.path,
      mode: '100644',
      type: 'blob',
      sha: blobRes.data.sha,
    });
    console.log(`  [${i + 1}/${files.length}] ${f.path}`);
  }

  // Create tree
  console.log('Creating tree...');
  const newTreeRes = await apiRequest('POST', '/git/trees', {
    base_tree: treeSha,
    tree: treeItems,
  });
  if (newTreeRes.status !== 201) {
    console.error('Failed to create tree:', newTreeRes.status, newTreeRes.data);
    process.exit(1);
  }
  console.log('New tree SHA:', newTreeRes.data.sha);

  // Create commit
  console.log('Creating commit...');
  const newCommitRes = await apiRequest('POST', '/git/commits', {
    message: 'feat: 线下门店ERP管理系统 - 初始部署版本\n\n- 工作台、收银台、订单管理、商品管理\n- 库存管理、供应商、会员营销、数据统计\n- 系统设置：门店管理、角色权限、邀请码\n- UI风格：链动小铺风格，左右分栏登录页',
    tree: newTreeRes.data.sha,
    parents: [currentSha],
  });
  if (newCommitRes.status !== 201) {
    console.error('Failed to create commit:', newCommitRes.status, newCommitRes.data);
    process.exit(1);
  }
  console.log('New commit SHA:', newCommitRes.data.sha);

  // Update ref
  console.log('Updating ref...');
  const updateRes = await apiRequest('PATCH', `/git/refs/heads/${BRANCH}`, {
    sha: newCommitRes.data.sha,
    force: true,
  });
  if (updateRes.status === 200) {
    console.log('SUCCESS! Code pushed to GitHub!');
    console.log(`View at: https://github.com/${OWNER}/${REPO}`);
  } else {
    console.error('Failed to update ref:', updateRes.status, updateRes.data);
  }
}

main().catch(console.error);
